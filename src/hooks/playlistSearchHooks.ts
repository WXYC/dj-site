"use client";

import { useLazySearchPlaylistsQuery } from "@/lib/features/playlist-search/api";
import {
  playlistSearchSlice,
  SearchRow,
} from "@/lib/features/playlist-search/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { PlaylistSearchResult } from "@wxyc/shared";
import type { PlaylistSearchParams } from "@wxyc/shared/dtos";

type SortField = PlaylistSearchParams["sort"];
type SortOrder = PlaylistSearchParams["order"];

const MIN_QUERY_LENGTH = 2;
const LIMIT = 50;

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
 * Build a query string from search rows.
 * Supports AND, OR, NOT operators and exact phrase matching.
 * The "all" field has no prefix — it's a plain text search.
 */
function buildQuery(rows: SearchRow[]): string {
  const parts: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.value.trim()) continue;

    let term = row.value.trim();

    // Format the value based on field type
    if (row.field === "dateRange" && row.valueTo) {
      term = `${row.value}..${row.valueTo}`;
    }

    // Wrap in quotes if exact match is requested
    if (row.exact) {
      term = `"${term}"`;
    }

    const fieldPrefix =
      row.field === "all" ? "" : fieldPrefixes[row.field] || "";
    const fullTerm = `${fieldPrefix}${term}`;

    // First row doesn't have an operator prefix
    if (i === 0) {
      parts.push(fullTerm);
    } else {
      parts.push(`${row.operator} ${fullTerm}`);
    }
  }

  return parts.join(" ");
}

export function usePlaylistSearch() {
  const dispatch = useAppDispatch();

  const rows = useAppSelector(playlistSearchSlice.selectors.getRows);
  const sortBy = useAppSelector(playlistSearchSlice.selectors.getSortBy);
  const sortOrder = useAppSelector(playlistSearchSlice.selectors.getSortOrder);
  const cursor = useAppSelector(playlistSearchSlice.selectors.getCursor);

  const effectiveQuery = useMemo(() => buildQuery(rows), [rows]);

  // null sentinel = "never fired" — distinguishes initial mount from a
  // user-cleared empty query so the on-mount empty-q request still goes out.
  const lastFiredQueryRef = useRef<string | null>(null);
  const lastFiredParamsRef = useRef<{
    cursor: string | null;
    sortBy: SortField;
    sortOrder: SortOrder;
  }>({
    cursor: null,
    sortBy: "date",
    sortOrder: "desc",
  });

  // Accumulated results for infinite scroll. Held in state — not a ref —
  // so the data-arrival effect re-renders the consumer once the new page
  // lands. The earlier ref-based implementation (issue #540) silently
  // mutated after render and never projected back into the DOM, so the
  // page surfaced "Found N results" copy with an empty table beneath.
  const [accumulatedResults, setAccumulatedResults] = useState<
    PlaylistSearchResult[]
  >([]);
  const lastQueryForAccumulationRef = useRef<string>("");

  const [trigger, { data, isFetching, isError, originalArgs }] =
    useLazySearchPlaylistsQuery();

  // The cursor that actually PRODUCED `data`, read from the request's
  // originalArgs — not the live `cursor` selector. Typing resets the slice
  // cursor to null (frontend.ts updateRow/setSort) one render before the new
  // fetch lands, so the live cursor no longer describes the in-hand `data`.
  // Basing replace-vs-append on this fingerprint keeps a just-blanked
  // accumulator from being repopulated with the prior query's rows (#604).
  const producingCursor = originalArgs?.cursor ?? null;

  // Reset accumulated results when query or sort changes.
  // ORDERING INVARIANT: this effect must stay declared BEFORE the accumulate
  // effect below — when the new query's first page lands, both run in the same
  // commit and reset-then-populate is what keeps the fresh page from being
  // blanked (populate-then-reset would wipe it).
  useEffect(() => {
    const currentParams = `${effectiveQuery}-${sortBy}-${sortOrder}`;
    if (currentParams !== lastQueryForAccumulationRef.current) {
      setAccumulatedResults([]);
      lastQueryForAccumulationRef.current = currentParams;
    }
  }, [effectiveQuery, sortBy, sortOrder]);

  // Accumulate results when new data arrives. A null producing cursor means
  // "first page" so we replace; otherwise we append (deduping by id) since the
  // user is paginating. Keyed on `producingCursor` (the cursor that produced
  // `data`), never the live `cursor` — a live-cursor flip on a new query
  // re-fired this effect against the previous query's `data` and replaced the
  // blanked accumulator with stale rows (#604).
  useEffect(() => {
    if (data?.results) {
      if (producingCursor === null) {
        setAccumulatedResults(data.results);
      } else {
        setAccumulatedResults((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newResults = data.results.filter((r) => !existingIds.has(r.id));
          return [...prev, ...newResults];
        });
      }
    }
  }, [data, producingCursor]);

  // Fire search when query or params change (response-based throttling).
  //
  // This single effect is ALSO the mid-flight change protection (#623): a
  // sort/cursor/query change made while a request is in flight takes the
  // isFetching branch (no-op), and when the request settles, isFetching
  // flipping false re-runs this effect against the live tuple. The full-tuple
  // comparison — query string AND cursor/sortBy/sortOrder — is what fires the
  // deferred request; if it compared the query string alone, a mid-flight
  // sort/cursor change with unchanged query text would be silently dropped.
  // There is no separate drain queue: the live selectors at settle time are
  // exactly the params the user last requested.
  useEffect(() => {
    // Empty query is the "show recent tracks" default. Single-character
    // partials still get debounced — wait for at least MIN_QUERY_LENGTH
    // chars before issuing a substring match.
    const isPartialQuery =
      effectiveQuery.length > 0 && effectiveQuery.length < MIN_QUERY_LENGTH;
    if (isPartialQuery) return;

    // Request in flight — defer. The settle re-run (isFetching dep) picks the
    // change up.
    if (isFetching) return;

    const paramsChanged =
      cursor !== lastFiredParamsRef.current.cursor ||
      sortBy !== lastFiredParamsRef.current.sortBy ||
      sortOrder !== lastFiredParamsRef.current.sortOrder;

    if (effectiveQuery !== lastFiredQueryRef.current || paramsChanged) {
      lastFiredQueryRef.current = effectiveQuery;
      lastFiredParamsRef.current = { cursor, sortBy, sortOrder };
      trigger({
        q: effectiveQuery,
        limit: LIMIT,
        sort: sortBy,
        order: sortOrder,
        cursor: cursor ?? undefined,
      });
    }
  }, [effectiveQuery, cursor, sortBy, sortOrder, isFetching, trigger]);

  // Actions
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

  const handleSort = useCallback(
    (field: "date" | "artist" | "song" | "dj") =>
      dispatch(playlistSearchSlice.actions.setSort(field)),
    [dispatch],
  );

  // Load the next page by advancing the cursor to whatever the last response
  // returned. No-op when no nextCursor is available (last page or response
  // not yet arrived).
  const loadNextPage = useCallback(() => {
    if (data?.nextCursor) {
      dispatch(playlistSearchSlice.actions.advanceCursor(data.nextCursor));
    }
  }, [dispatch, data?.nextCursor]);

  const reset = useCallback(() => {
    setAccumulatedResults([]);
    lastQueryForAccumulationRef.current = "";
    dispatch(playlistSearchSlice.actions.reset());
  }, [dispatch]);

  const hasMore = data?.nextCursor !== undefined;

  // True when a change arrived while a request was in flight and is waiting
  // for the settle re-fire: same tuple-vs-last-fired comparison the fire
  // effect uses, so the two can't disagree.
  const isPartialQuery =
    effectiveQuery.length > 0 && effectiveQuery.length < MIN_QUERY_LENGTH;
  const hasPendingQuery =
    isFetching &&
    !isPartialQuery &&
    (effectiveQuery !== lastFiredQueryRef.current ||
      cursor !== lastFiredParamsRef.current.cursor ||
      sortBy !== lastFiredParamsRef.current.sortBy ||
      sortOrder !== lastFiredParamsRef.current.sortOrder);

  return {
    // State
    rows,
    sortBy,
    sortOrder,
    cursor,
    effectiveQuery,

    // Results
    results: accumulatedResults,
    total: data?.total ?? 0,
    hasMore,

    // Loading states
    isLoading: isFetching,
    hasPendingQuery,
    isError,

    // Actions
    addRow,
    removeRow,
    updateRow,
    handleSort,
    loadNextPage,
    reset,
  };
}
