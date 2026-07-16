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

  // State, not a ref, so the data-arrival effect actually re-renders the
  // consumer — a ref-based version (#540) mutated after render without
  // projecting into the DOM, so the page showed "Found N results" over an
  // empty table.
  const [accumulatedResults, setAccumulatedResults] = useState<
    PlaylistSearchResult[]
  >([]);
  const lastQueryForAccumulationRef = useRef<string>("");

  const [trigger, { data, isFetching, isError, originalArgs }] =
    useLazySearchPlaylistsQuery();

  // The cursor that actually PRODUCED `data` (from originalArgs), not the
  // live `cursor` selector — typing resets the slice cursor to null one
  // render before the new fetch lands, so the live cursor can't be trusted
  // to describe the in-hand `data`. Basing replace-vs-append on this
  // fingerprint keeps a just-blanked accumulator from being repopulated with
  // the prior query's rows (#604).
  const producingCursor = originalArgs?.cursor ?? null;

  // ORDERING INVARIANT: this effect must stay declared BEFORE the accumulate
  // effect below — when a new query's first page lands, both run in the same
  // commit, and reset-then-populate is what keeps the fresh page from being
  // blanked (populate-then-reset would wipe it).
  useEffect(() => {
    const currentParams = `${effectiveQuery}-${sortBy}-${sortOrder}`;
    if (currentParams !== lastQueryForAccumulationRef.current) {
      setAccumulatedResults([]);
      lastQueryForAccumulationRef.current = currentParams;
    }
  }, [effectiveQuery, sortBy, sortOrder]);

  // A null producingCursor means "first page" (replace); otherwise append,
  // deduped by id (paginating). Keyed on producingCursor, never the live
  // `cursor` — a live-cursor flip on a new query previously re-fired this
  // against the prior query's `data`, replacing the blanked accumulator with
  // stale rows (#604).
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

  // Fires search on query/params change, and IS the mid-flight change
  // protection (#623): a change made while a request is in flight hits the
  // isFetching no-op branch below, then the settle (isFetching -> false)
  // re-runs this effect against the live tuple. Comparing the FULL tuple
  // (query AND cursor/sortBy/sortOrder), not just the query string, is what
  // fires that deferred request — a query-only comparison would silently
  // drop a mid-flight sort/cursor change. No separate drain queue is needed:
  // the live selectors at settle time are exactly the params last requested.
  useEffect(() => {
    // Debounce single-character partials; empty query is the "show recent
    // tracks" default and fires immediately.
    const isPartialQuery =
      effectiveQuery.length > 0 && effectiveQuery.length < MIN_QUERY_LENGTH;
    if (isPartialQuery) return;

    // Defer while a request is in flight; the settle re-run picks it up.
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

  // No-op when nextCursor is unavailable (last page or response not yet arrived).
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

  // Same tuple-vs-last-fired comparison the fire effect uses, so the two
  // can't disagree about whether a change is waiting for the settle re-fire.
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
    rows,
    sortBy,
    sortOrder,
    cursor,
    effectiveQuery,

    results: accumulatedResults,
    total: data?.total ?? 0,
    hasMore,

    isLoading: isFetching,
    hasPendingQuery,
    isError,

    addRow,
    removeRow,
    updateRow,
    handleSort,
    loadNextPage,
    reset,
  };
}
