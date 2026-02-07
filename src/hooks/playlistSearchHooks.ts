"use client";

import { useLazySearchPlaylistsQuery } from "@/lib/features/playlist-search/api";
import { playlistSearchSlice, SearchRow } from "@/lib/features/playlist-search/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useEffect, useRef, useMemo } from "react";
import type { PlaylistSearchResult } from "@wxyc/shared";

const MIN_QUERY_LENGTH = 2;
const LIMIT = 50;

/**
 * Build a query string from advanced search rows.
 * Supports AND, OR, NOT operators and exact phrase matching.
 */
function buildAdvancedQuery(rows: SearchRow[]): string {
  const parts: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.value.trim()) continue;

    let term = row.value.trim();

    // Handle field-specific prefixes for backend parsing
    const fieldPrefixes: Record<string, string> = {
      artist: "artist:",
      song: "song:",
      album: "album:",
      label: "label:",
      dj: "dj:",
      date: "date:",
      dateRange: "dateRange:",
    };

    // Format the value based on field type
    if (row.field === "dateRange" && row.valueTo) {
      term = `${row.value}..${row.valueTo}`;
    }

    // Wrap in quotes if exact match is requested
    if (row.exact) {
      term = `"${term}"`;
    }

    const fieldPrefix = fieldPrefixes[row.field] || "";
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

  const mode = useAppSelector(playlistSearchSlice.selectors.getMode);
  const simpleQuery = useAppSelector(playlistSearchSlice.selectors.getSimpleQuery);
  const advancedRows = useAppSelector(playlistSearchSlice.selectors.getAdvancedRows);
  const sortBy = useAppSelector(playlistSearchSlice.selectors.getSortBy);
  const sortOrder = useAppSelector(playlistSearchSlice.selectors.getSortOrder);
  const page = useAppSelector(playlistSearchSlice.selectors.getPage);

  // Build the effective query based on mode
  const effectiveQuery = useMemo(() => {
    if (mode === "simple") {
      return simpleQuery;
    }
    return buildAdvancedQuery(advancedRows);
  }, [mode, simpleQuery, advancedRows]);

  // Track pending query to fire after current request completes
  const pendingQueryRef = useRef<string | null>(null);
  const lastFiredQueryRef = useRef<string>("");
  const lastFiredParamsRef = useRef<{ page: number; sortBy: string; sortOrder: string }>({
    page: 0,
    sortBy: "date",
    sortOrder: "desc",
  });

  // Accumulated results for infinite scroll
  const accumulatedResultsRef = useRef<PlaylistSearchResult[]>([]);
  const lastQueryForAccumulationRef = useRef<string>("");

  const [trigger, { data, isLoading, isFetching, isError }] = useLazySearchPlaylistsQuery();

  // Reset accumulated results when query or sort changes
  useEffect(() => {
    const currentParams = `${effectiveQuery}-${sortBy}-${sortOrder}`;
    if (currentParams !== lastQueryForAccumulationRef.current) {
      accumulatedResultsRef.current = [];
      lastQueryForAccumulationRef.current = currentParams;
    }
  }, [effectiveQuery, sortBy, sortOrder]);

  // Accumulate results when new data arrives
  useEffect(() => {
    if (data?.results) {
      if (page === 0) {
        accumulatedResultsRef.current = data.results;
      } else {
        // Append new results, avoiding duplicates by ID
        const existingIds = new Set(accumulatedResultsRef.current.map(r => r.id));
        const newResults = data.results.filter(r => !existingIds.has(r.id));
        accumulatedResultsRef.current = [...accumulatedResultsRef.current, ...newResults];
      }
    }
  }, [data, page]);

  // Fire search when query changes (response-based throttling)
  useEffect(() => {
    if (effectiveQuery.length < MIN_QUERY_LENGTH) {
      pendingQueryRef.current = null;
      return;
    }

    const paramsChanged =
      page !== lastFiredParamsRef.current.page ||
      sortBy !== lastFiredParamsRef.current.sortBy ||
      sortOrder !== lastFiredParamsRef.current.sortOrder;

    if (isFetching) {
      // Request in flight - queue this query for later
      pendingQueryRef.current = effectiveQuery;
    } else if (effectiveQuery !== lastFiredQueryRef.current || paramsChanged) {
      // No request in flight and query/params changed - fire immediately
      lastFiredQueryRef.current = effectiveQuery;
      lastFiredParamsRef.current = { page, sortBy, sortOrder };
      pendingQueryRef.current = null;
      trigger({ q: effectiveQuery, page, limit: LIMIT, sort: sortBy, order: sortOrder });
    }
  }, [effectiveQuery, page, sortBy, sortOrder, isFetching, trigger]);

  // When request completes, check if there's a pending query
  useEffect(() => {
    if (!isFetching && pendingQueryRef.current && pendingQueryRef.current !== lastFiredQueryRef.current) {
      const pending = pendingQueryRef.current;
      lastFiredQueryRef.current = pending;
      lastFiredParamsRef.current = { page, sortBy, sortOrder };
      pendingQueryRef.current = null;
      trigger({ q: pending, page, limit: LIMIT, sort: sortBy, order: sortOrder });
    }
  }, [isFetching, page, sortBy, sortOrder, trigger]);

  // Actions
  const setMode = useCallback(
    (newMode: "simple" | "advanced") => dispatch(playlistSearchSlice.actions.setMode(newMode)),
    [dispatch]
  );

  const setSimpleQuery = useCallback(
    (q: string) => dispatch(playlistSearchSlice.actions.setSimpleQuery(q)),
    [dispatch]
  );

  const addRow = useCallback(
    () => dispatch(playlistSearchSlice.actions.addRow()),
    [dispatch]
  );

  const removeRow = useCallback(
    (id: string) => dispatch(playlistSearchSlice.actions.removeRow(id)),
    [dispatch]
  );

  const updateRow = useCallback(
    (id: string, updates: Partial<SearchRow>) =>
      dispatch(playlistSearchSlice.actions.updateRow({ id, updates })),
    [dispatch]
  );

  const handleSort = useCallback(
    (field: "date" | "artist" | "song" | "dj") => dispatch(playlistSearchSlice.actions.setSort(field)),
    [dispatch]
  );

  const loadNextPage = useCallback(
    () => dispatch(playlistSearchSlice.actions.nextPage()),
    [dispatch]
  );

  const reset = useCallback(
    () => {
      accumulatedResultsRef.current = [];
      lastQueryForAccumulationRef.current = "";
      dispatch(playlistSearchSlice.actions.reset());
    },
    [dispatch]
  );

  const hasMore = data ? page < data.totalPages - 1 : false;

  return {
    // State
    mode,
    simpleQuery,
    advancedRows,
    sortBy,
    sortOrder,
    page,
    effectiveQuery,

    // Results
    results: accumulatedResultsRef.current,
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    hasMore,

    // Loading states
    isLoading: isFetching,
    hasPendingQuery: pendingQueryRef.current !== null,
    isError,

    // Actions
    setMode,
    setSimpleQuery,
    addRow,
    removeRow,
    updateRow,
    handleSort,
    loadNextPage,
    reset,
  };
}
