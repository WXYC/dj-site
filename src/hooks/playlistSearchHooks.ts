"use client";

import { useSearchPlaylistsInfiniteQuery } from "@/lib/features/playlist-search/api";
import {
  playlistSearchSlice,
  SearchRow,
} from "@/lib/features/playlist-search/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useMemo } from "react";
import type { PlaylistSearchResult } from "@wxyc/shared";

export const MIN_QUERY_LENGTH = 2;
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

  const effectiveQuery = useMemo(() => buildQuery(rows), [rows]);

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

  // refetchOnMountOrArgChange preserves the old lazy trigger()'s always-fetch
  // semantics: the archive gains entries continuously, so re-entering the page
  // (or revisiting a prior sort within RTK's cache-retention window) must fetch
  // fresh page 1 rather than serve a stale cached entry. It does not affect
  // in-session appends — fetchNextPage keeps the same arg, so no refetch fires.
  const { data, isFetching, isError, hasNextPage, fetchNextPage } =
    useSearchPlaylistsInfiniteQuery(queryArg, {
      skip: isPartialQuery,
      refetchOnMountOrArgChange: true,
    });

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

  // No-op when there is no next page (last page or response not yet arrived).
  const loadNextPage = useCallback(() => {
    if (hasNextPage) void fetchNextPage();
  }, [hasNextPage, fetchNextPage]);

  return {
    rows,
    sortBy,
    sortOrder,
    effectiveQuery,

    results,
    total: data?.pages?.[0]?.total ?? 0,
    hasMore: hasNextPage ?? false,

    isLoading: isFetching,
    isError,

    addRow,
    removeRow,
    updateRow,
    handleSort,
    loadNextPage,
  };
}
