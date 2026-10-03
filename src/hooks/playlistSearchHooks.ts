"use client";

import {
  playlistSearchApi,
  useSearchPlaylistsInfiniteQuery,
} from "@/lib/features/playlist-search/api";
import {
  playlistSearchSlice,
  SearchRow,
  type SortField,
  type SortOrder,
} from "@/lib/features/playlist-search/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { useCallback, useMemo, useRef, useState } from "react";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { useListingRetry } from "./useListingRetry";

export type { FailedPage } from "./useListingRetry";

export const MIN_QUERY_LENGTH = 2;

const LIMIT = 50;

/**
 * How long the typed query settles before it is fetched.
 *
 * tubafrenzy's `playlist-search.js` held the same 300ms (`f = 300`) between the
 * last keystroke and `triggerSearch`, and the delay is doing more work than
 * sparing the endpoint: re-keying rebuilds the results table under the reader,
 * and a row is a full-width click target, so a click meant for the search box
 * lands on whichever row slid beneath the pointer. A two-finger typist hits
 * that on nearly every search.
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The empty query is the canonical "recent playlists" listing, not the absence
 * of a search — it is requested and it renders. A sub-threshold partial is the
 * only state with nothing to show, because it is the only one the hook skips.
 *
 * These live here, beside the skip rule they mirror, so a surface cannot gate
 * its results on a threshold the fetch does not use. Divergence between the two
 * reads as "the page fetched rows and then hid them".
 */
export const isDefaultQuery = (query: string): boolean => query.length === 0;
export const isRealQuery = (query: string): boolean =>
  query.length >= MIN_QUERY_LENGTH;
export const shouldShowResults = (query: string): boolean =>
  isDefaultQuery(query) || isRealQuery(query);

/**
 * The chronological "Previous Sets" listing's own mode: the default query,
 * newest first. Takes the sort pair explicitly rather than reading the slice
 * itself, since an empty query sorted by artist is the default query in a
 * different mode, not this one. Takes the query exactly as handed -- a
 * caller passes the settled `effectiveQuery`, never the typed one -- paired
 * with the live sort.
 */
export const isChronologicalMode = (
  query: string,
  sortBy: SortField,
  sortOrder: SortOrder,
): boolean => isDefaultQuery(query) && sortBy === "date" && sortOrder === "desc";

// Stable identity for the no-seed case; a fresh [] each render would make
// displayResults a new reference on every pass.
const NO_SEED: readonly PlaylistSearchResult[] = [];

/** Field-specific prefixes for backend query parsing. */
const fieldPrefixes: Record<string, string> = {
  artist: "artist:",
  song: "song:",
  album: "album:",
  label: "label:",
  dj: "dj:",
  date: "date:",
  dateRange: "dateRange:",
};

/**
 * Builds a query string from search rows. Supports AND/OR/NOT operators and
 * exact phrase matching; the "all" field has no prefix (plain text search).
 */
function buildQuery(rows: SearchRow[]): string {
  const parts: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.value.trim()) continue;

    let term = row.value.trim();

    if (row.field === "dateRange" && row.valueTo) {
      term = `${row.value}..${row.valueTo}`;
    }

    if (row.exact) {
      term = `"${term}"`;
    }

    const fieldPrefix =
      row.field === "all" ? "" : fieldPrefixes[row.field] || "";
    const fullTerm = `${fieldPrefix}${term}`;

    if (i === 0) {
      parts.push(fullTerm);
    } else {
      parts.push(`${row.operator} ${fullTerm}`);
    }
  }

  return parts.join(" ");
}

/** How many times `count` has come in lower than on the render before. */
function useDecreaseCount(count: number): number {
  const [seen, setSeen] = useState({ count, decreases: 0 });
  if (count !== seen.count) {
    setSeen({
      count,
      decreases: seen.decreases + (count < seen.count ? 1 : 0),
    });
  }
  return seen.decreases;
}

/**
 * Which cache entry the screen means, derived from the slice.
 *
 * Shared by the consumers and by the subscription that outlives them, so the
 * one place a key is built is the one place it can change. The subscription
 * does deliberately hold a *stale* key while a sub-threshold partial is being
 * typed; what this rules out is the two disagreeing about how a key is built,
 * which would surface as a silent re-fetch rather than as an error.
 */
function usePlaylistSearchKey() {
  const rows = useAppSelector(playlistSearchSlice.selectors.getRows);
  const sortBy = useAppSelector(playlistSearchSlice.selectors.getSortBy);
  const sortOrder = useAppSelector(playlistSearchSlice.selectors.getSortOrder);

  const typedQuery = useMemo(() => buildQuery(rows), [rows]);

  // Only the query settles; `rows` stays live, so the input it controls never
  // lags the keystroke. Everything downstream reads the settled value, which is
  // what keeps "Found N results" describing the search that actually ran rather
  // than the one still being typed.
  //
  // A removed row is the exception: it is one finished edit, with no further
  // keystroke for the wait to absorb, so the query it leaves settles at once.
  // The settled query is written into the debounce rather than returned in
  // its place, or the next keystroke would put the pre-removal query back in
  // effect until its own wait ran out.
  const rowsRemoved = useDecreaseCount(rows.length);
  const effectiveQuery = useDebouncedValue(
    typedQuery,
    SEARCH_DEBOUNCE_MS,
    rowsRemoved,
  );

  // A single-character partial isn't worth a request; an empty query is the
  // "show recent tracks" default and must fire.
  const isPartialQuery =
    effectiveQuery.length > 0 && effectiveQuery.length < MIN_QUERY_LENGTH;

  // The search key. Changing it re-keys the RTK cache entry, restarting
  // pagination from initialPageParam — replace-on-new-query. fetchNextPage
  // appends further pages within the current key. A key change mid-flight is
  // picked up by RTK's own refetch, so no manual defer-until-settle is needed.
  const queryArg = useMemo(
    () => ({ q: effectiveQuery, limit: LIMIT, sort: sortBy, order: sortOrder }),
    [effectiveQuery, sortBy, sortOrder],
  );

  return { effectiveQuery, isPartialQuery, queryArg, sortBy, sortOrder };
}

/**
 * Holds the listing's accumulated pages for as long as the playlists screen is
 * open — including while a show is being read, which unmounts the listing.
 *
 * Mounted above that screen's show/listing branch, so the branch flipping can
 * no longer unsubscribe the entry. Retention is the only other thing that could
 * decide this, and it cannot: a window long enough to cover reading a show is
 * also long enough to serve the next arrival a stale page 1.
 *
 * `listingVisible` latches rather than gating continuously. A permalink opening
 * straight into a show, or into the week grid, must not spend a request on a
 * listing nobody asked for — but once the listing has been on screen, its pages
 * are worth holding for the rest of the visit.
 *
 * `skipChronological`, set by a surface that renders the chronological
 * default from the archive stream instead, skips this subscription whenever
 * the settled query is in chronological mode. The returned `chronological`
 * tells that caller when that is, read off this hook's own settled key: the
 * surface holds neither the query nor the sort. `Results` derives the mode
 * from its own settled key, so the two can disagree for a render while a
 * query settles.
 */
export function usePlaylistSearchSubscription(
  listingVisible: boolean,
  { skipChronological = false }: { skipChronological?: boolean } = {},
): { chronological: boolean } {
  const { queryArg, isPartialQuery, effectiveQuery, sortBy, sortOrder } =
    usePlaylistSearchKey();
  const chronological = isChronologicalMode(effectiveQuery, sortBy, sortOrder);
  const skip = skipChronological && chronological;

  // Null until the listing has actually been on screen, and that null is what
  // gates the request: a permalink opening straight into a show, or into the
  // week grid, must not spend one on a listing nobody asked for.
  //
  // Afterwards it holds the last *addressable* key rather than the current one.
  // A sub-threshold partial is a detour every consumer skips, so following it
  // would leave the entry the reader is coming back to with no subscriber at
  // all — and at zero retention it would be gone before the keystroke that
  // undoes the typo. Nothing outside the listing can move the key, so freezing
  // it while the listing is away is safe.
  //
  // This keeps the pages, not the place: a partial empties the listing, so the
  // scrollport collapses and the browser clamps the offset to the top before
  // anything can record it. The walk surviving is the expensive half.
  //
  // A chronological listing is not held: its pages are the archive stream's,
  // so latching the default key here would walk the archive a second time.
  // The skip check runs first and clears the ref outright -- a ranked key
  // latched before the reader turned the sort to chronological must not
  // survive the turn, or a later sub-threshold partial (which also blocks
  // the latch) would resubscribe that stale key instead of finding it empty.
  const heldArg = useRef<typeof queryArg | null>(null);
  if (skip) {
    heldArg.current = null;
  } else if (listingVisible && !isPartialQuery) {
    heldArg.current = queryArg;
  }

  // Subscription only. The state half of the combined hook installs a selector
  // whose value is discarded here, and would re-render the whole surface — the
  // view toggle and the branch around it — on each of a page append's two
  // status changes.
  playlistSearchApi.endpoints.searchPlaylists.useInfiniteQuerySubscription(
    heldArg.current ?? queryArg,
    { skip: heldArg.current === null || skip },
  );

  return { chronological };
}

/**
 * The slice half of {@link usePlaylistSearch}: rows, sort and their actions,
 * with no subscription to `playlistSearchApi`.
 *
 * For a consumer that only edits the search — the search bar's rows, the sort
 * select — composing this in directly, rather than going through
 * `usePlaylistSearch`, keeps it off the query's subscriber list entirely.
 *
 * Reads `rows`/`sortBy`/`sortOrder` straight off the slice rather than through
 * `usePlaylistSearchKey`: that helper also builds the query string and runs
 * the search debounce, both of which only the query-subscribed half needs. A
 * consumer here would receive and then discard them, and — because
 * `usePlaylistSearch` composes this hook in and also calls
 * `usePlaylistSearchKey` directly for the query — sharing it would double the
 * debounce's state and timer for every `usePlaylistSearch` consumer.
 */
export function usePlaylistSearchControls() {
  const dispatch = useAppDispatch();
  const rows = useAppSelector(playlistSearchSlice.selectors.getRows);
  const sortBy = useAppSelector(playlistSearchSlice.selectors.getSortBy);
  const sortOrder = useAppSelector(playlistSearchSlice.selectors.getSortOrder);

  const addRow = useCallback(
    () => dispatch(playlistSearchSlice.actions.addRow()),
    [dispatch],
  );

  const removeRow = useCallback(
    (id: string) => dispatch(playlistSearchSlice.actions.removeRow(id)),
    [dispatch],
  );

  const updateRow = useCallback(
    (id: string, updates: Partial<SearchRow>) =>
      dispatch(playlistSearchSlice.actions.updateRow({ id, updates })),
    [dispatch],
  );

  const setSort = useCallback(
    (next: { sortBy: SortField; sortOrder: SortOrder }) =>
      dispatch(playlistSearchSlice.actions.setSort(next)),
    [dispatch],
  );

  const handleSort = useCallback(
    (field: SortField) =>
      dispatch(playlistSearchSlice.actions.toggleSort(field)),
    [dispatch],
  );

  return {
    rows,
    sortBy,
    sortOrder,
    addRow,
    removeRow,
    updateRow,
    setSort,
    handleSort,
  };
}

/**
 * Rows, sort and the ranked query's results together, subscribed through
 * `playlistSearchApi`.
 *
 * `skipChronological`, set by a surface that renders the chronological
 * default from the archive stream instead, skips the query here whenever the
 * settled query is in chronological mode — this hook's own query, not
 * `usePlaylistSearchSubscription`'s held one, so the two must be given the
 * same flag by the same caller or they would disagree about whose rows are
 * on screen.
 */
export function usePlaylistSearch({
  skipChronological = false,
}: { skipChronological?: boolean } = {}) {
  const {
    rows,
    sortBy,
    sortOrder,
    addRow,
    removeRow,
    updateRow,
    setSort,
    handleSort,
  } = usePlaylistSearchControls();
  const { effectiveQuery, isPartialQuery, queryArg } = usePlaylistSearchKey();
  const skip =
    isPartialQuery ||
    (skipChronological &&
      isChronologicalMode(effectiveQuery, sortBy, sortOrder));

  // No refetch-on-mount. Freshness is a lifetime here rather than a refetch:
  // the entry is dropped the moment the screen is left (keepUnusedDataFor: 0),
  // so a fresh arrival finds nothing cached and fetches page 1 of its own
  // accord, while a return from a show finds every walked page still in hand.
  // Forcing a refetch instead would re-run the whole accumulated walk — RTK
  // re-fetches a forced infinite query page by page — against an endpoint whose
  // result count is capped precisely because it is expensive.
  //
  // The listing is therefore not refreshed again for the life of the screen,
  // and that life is not bounded by a show visit — a detour through the week
  // view can run for hours and come back to the page 1 it left. The archive
  // gains entries continuously, so this is staleness traded for the walk, not
  // staleness nobody pays.
  const {
    data,
    currentData,
    isFetching,
    isError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useSearchPlaylistsInfiniteQuery(queryArg, { skip });

  const results = useMemo<PlaylistSearchResult[]>(() => {
    if (!data?.pages?.length) return [];
    const seen = new Set<number>();
    const flat: PlaylistSearchResult[] = [];
    for (const page of data.pages) {
      for (const row of page.results) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          flat.push(row);
        }
      }
    }
    return flat;
  }, [data?.pages]);

  // No-op when there is no next page (last page or response not yet arrived),
  // and no-op once a page has failed. A rejected page is not appended, so the
  // walk's next param survives and `hasNextPage` stays true — and the callers
  // that drive this are re-armed by the very status change a failure produces
  // (classic rebuilds its IntersectionObserver whenever `isLoading` flips, and
  // a fresh observer fires immediately for a sentinel already in view). Left
  // ungated, one broken page becomes an unthrottled retry loop against an
  // endpoint this file's own retention notes call expensive.
  const loadNextPage = useCallback(() => {
    if (hasNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isError, fetchNextPage]);

  // `currentData`, not `data`: after a sort or query change, `data` still
  // holds the previous key's pages until the new key succeeds, which would
  // read a failed first page of the new search as a failed later page.
  const hasAnyPages = (currentData?.pages?.length ?? 0) > 0;
  const { retry, failedPage, isRetrying, failedRetries } = useListingRetry({
    key: queryArg,
    isFetching,
    isError,
    hasAnyPages,
    refetch,
    fetchNextPage,
  });

  return {
    rows,
    sortBy,
    sortOrder,
    effectiveQuery,

    results,
    total: data?.pages?.[0]?.total ?? 0,
    hasMore: hasNextPage ?? false,

    // Whether the client query for the *current* key has produced an answer,
    // empty or not. `results.length > 0` cannot stand in for this: a listing
    // that legitimately comes back with no rows never answers by that measure.
    hasAnswered: data !== undefined || isError,

    isLoading: isFetching,
    isError,
    // Which page the failure notice is about, kept while a retry of it runs.
    failedPage,
    isRetrying,
    failedRetries,

    addRow,
    removeRow,
    updateRow,
    setSort,
    handleSort,
    loadNextPage,
    retry,
  };
}

export interface UsePlaylistSearchResultsOptions {
  /**
   * Server-rendered first page for the default query, so the initial HTML
   * carries rows instead of an empty table that fills in on hydration.
   */
  initialResults?: readonly PlaylistSearchResult[];
  /**
   * Set only by a surface that renders the chronological listing from the
   * archive stream instead, so the default query is not fetched here.
   */
  skipChronological?: boolean;
}

/**
 * Owns *which* rows a playlist surface renders, and whether the server seed is
 * still standing in for the client query.
 *
 * Every playlist surface consumes this rather than assembling the rules itself.
 * The seed-retirement rule below is subtle enough that a second copy of it will
 * drift, and the containers disagreeing about which rows to show is the exact
 * class of defect this replaced.
 */
export function usePlaylistSearchResults(
  options: UsePlaylistSearchResultsOptions = {},
) {
  const search = usePlaylistSearch({
    skipChronological: options.skipChronological,
  });
  const { results, effectiveQuery, hasAnswered } = search;
  const initialResults = options.initialResults ?? NO_SEED;

  // The seed retires permanently on the client query's first answer. It turns
  // on the query having *settled*, not on it having returned rows: a default
  // listing that comes back empty is an answer, and keying this on row count
  // would leave the server's rows on screen forever contradicting it.
  //
  // Retirement is permanent because changing the sort re-keys the RTK cache
  // entry, which empties `results` while the new key is in flight; resurfacing
  // the seed in that gap would flash rows in the server's order over the sort
  // the user just chose.
  const seedRetired = useRef(false);
  if (hasAnswered) {
    seedRetired.current = true;
  }

  const usingSeed =
    isDefaultQuery(effectiveQuery) &&
    results.length === 0 &&
    !seedRetired.current;

  return {
    ...search,
    displayResults: usingSeed
      ? (initialResults as PlaylistSearchResult[])
      : results,
    usingSeed,
    showResults: shouldShowResults(effectiveQuery),
    isRealQuery: isRealQuery(effectiveQuery),
    isDefaultQuery: isDefaultQuery(effectiveQuery),
  };
}
