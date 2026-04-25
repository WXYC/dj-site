"use client";

import { useLazySearchPlaylistsQuery } from "@/lib/features/playlist-search/api";
import {
  playlistSearchSlice,
  SearchRow,
} from "@/lib/features/playlist-search/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useEffect, useRef, useMemo } from "react";
import type { PlaylistSearchResult } from "@wxyc/shared";

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

  // Track pending query to fire after current request completes
  const pendingQueryRef = useRef<string | null>(null);
  // null sentinel = "never fired" — distinguishes initial mount from a
  // user-cleared empty query so the on-mount empty-q request still goes out.
  const lastFiredQueryRef = useRef<string | null>(null);
  const lastFiredParamsRef = useRef<{
    cursor: string | null;
    sortBy: string;
    sortOrder: string;
  }>({
    cursor: null,
    sortBy: "date",
    sortOrder: "desc",
  });

  // Accumulated results for infinite scroll
  const accumulatedResultsRef = useRef<PlaylistSearchResult[]>([]);
  const lastQueryForAccumulationRef = useRef<string>("");

  const [trigger, { data, isFetching, isError }] =
    useLazySearchPlaylistsQuery();

  // Reset accumulated results when query or sort changes
  useEffect(() => {
    const currentParams = `${effectiveQuery}-${sortBy}-${sortOrder}`;
    if (currentParams !== lastQueryForAccumulationRef.current) {
      accumulatedResultsRef.current = [];
      lastQueryForAccumulationRef.current = currentParams;
    }
  }, [effectiveQuery, sortBy, sortOrder]);

  // Accumulate results when new data arrives. cursor === null means "first
  // page" so we replace; otherwise we append (deduping by id) since the
  // user is paginating.
  useEffect(() => {
    if (data?.results) {
      if (cursor === null) {
        accumulatedResultsRef.current = data.results;
      } else {
        const existingIds = new Set(
          accumulatedResultsRef.current.map((r) => r.id),
        );
        const newResults = data.results.filter((r) => !existingIds.has(r.id));
        accumulatedResultsRef.current = [
          ...accumulatedResultsRef.current,
          ...newResults,
        ];
      }
    }
  }, [data, cursor]);

  // Fire search when query changes (response-based throttling)
  useEffect(() => {
    // Empty query is the "show recent tracks" default. Single-character
    // partials still get debounced — wait for at least MIN_QUERY_LENGTH
    // chars before issuing a substring match.
    const isPartialQuery =
      effectiveQuery.length > 0 && effectiveQuery.length < MIN_QUERY_LENGTH;
    if (isPartialQuery) {
      pendingQueryRef.current = null;
      return;
    }

    const paramsChanged =
      cursor !== lastFiredParamsRef.current.cursor ||
      sortBy !== lastFiredParamsRef.current.sortBy ||
      sortOrder !== lastFiredParamsRef.current.sortOrder;

    if (isFetching) {
      // Request in flight - queue this query for later
      pendingQueryRef.current = effectiveQuery;
    } else if (effectiveQuery !== lastFiredQueryRef.current || paramsChanged) {
      // No request in flight and query/params changed - fire immediately
      lastFiredQueryRef.current = effectiveQuery;
      lastFiredParamsRef.current = { cursor, sortBy, sortOrder };
      pendingQueryRef.current = null;
      trigger({
        q: effectiveQuery,
        limit: LIMIT,
        sort: sortBy,
        order: sortOrder,
        cursor: cursor ?? undefined,
      });
    }
  }, [effectiveQuery, cursor, sortBy, sortOrder, isFetching, trigger]);

  // When request completes, check if there's a pending query
  useEffect(() => {
    if (
      !isFetching &&
      pendingQueryRef.current &&
      pendingQueryRef.current !== lastFiredQueryRef.current
    ) {
      const pending = pendingQueryRef.current;
      lastFiredQueryRef.current = pending;
      lastFiredParamsRef.current = { cursor, sortBy, sortOrder };
      pendingQueryRef.current = null;
      trigger({
        q: pending,
        limit: LIMIT,
        sort: sortBy,
        order: sortOrder,
        cursor: cursor ?? undefined,
      });
    }
  }, [isFetching, cursor, sortBy, sortOrder, trigger]);

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
    accumulatedResultsRef.current = [];
    lastQueryForAccumulationRef.current = "";
    dispatch(playlistSearchSlice.actions.reset());
  }, [dispatch]);

  const hasMore = data?.nextCursor !== undefined;

  return {
    // State
    rows,
    sortBy,
    sortOrder,
    cursor,
    effectiveQuery,

    // Results
    results: accumulatedResultsRef.current,
    total: data?.total ?? 0,
    hasMore,

    // Loading states
    isLoading: isFetching,
    hasPendingQuery: pendingQueryRef.current !== null,
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
