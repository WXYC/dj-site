"use client";

import {
  useLazySearchLibraryQueryQuery,
  useSearchCatalogQuery,
} from "@/lib/features/catalog/api";
import { Authorization } from "@/lib/features/admin/types";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import {
  AlbumEntry,
  CatalogFilters,
  CatalogSearchField,
  CatalogSearchRow,
  CatalogSortBy,
  CatalogSortOrder,
  LibraryQueryParams,
} from "@/lib/features/catalog/types";
import { isAuthenticated } from "@/lib/features/authentication/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthentication } from "./authenticationHooks";
import { filterBySearchTerms } from "@/src/utilities/filterBySearchTerms";
import { mergeAlbumIntoSearchResult } from "@/lib/features/catalog/patchSearchResult";
import { catalogTagsToOnStreaming } from "@/src/components/experiences/modern/catalog/Search/catalogTagFilters";

const MIN_QUERY_LENGTH = 2;
const PAGE_LIMIT = 50;

/** Keep first occurrence per album id (backend may return duplicates in one page). */
export function dedupeAlbumEntriesById(entries: AlbumEntry[]): AlbumEntry[] {
  const seen = new Set<number>();
  const out: AlbumEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

/** UI-side field-prefix map (mirrors the backend's CATALOG_PARSER_CONFIG). */
const CATALOG_FIELD_PREFIXES: Record<CatalogSearchField, string | null> = {
  all: null,
  artist: "artist:",
  album: "album:",
  label: "label:",
};

/**
 * Render the query-builder rows back to the query string that the backend
 * parser will reparse. Field-agnostic except for the prefix map. Mirrors the
 * playlist-search hook's `buildQuery` so the two surfaces stay structurally
 * similar without prematurely sharing code.
 */
export function buildCatalogQuery(rows: CatalogSearchRow[]): string {
  const parts: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.value.trim()) continue;
    const value = row.exact ? `"${row.value.trim()}"` : row.value.trim();
    const prefix = CATALOG_FIELD_PREFIXES[row.field] ?? "";
    const fullTerm = `${prefix}${value}`;
    parts.push(i === 0 ? fullTerm : `${row.operator} ${fullTerm}`);
  }
  return parts.join(" ");
}

/**
 * Map UI state to the request shape. Empty genre/format arrays are omitted.
 */
export function toLibraryQueryParams(
  rows: CatalogSearchRow[],
  filters: CatalogFilters,
  page: number,
  sortBy: CatalogSortBy,
  sortOrder: CatalogSortOrder,
): LibraryQueryParams {
  const q = buildCatalogQuery(rows);
  return {
    q: q || undefined,
    page,
    limit: PAGE_LIMIT,
    sort: sortBy,
    order: sortOrder,
    on_streaming: catalogTagsToOnStreaming(filters.tags),
    genres:
      filters.genres.length > 0 ? filters.genres.join(",") : undefined,
    formats:
      filters.formats.length > 0 ? filters.formats.join(",") : undefined,
  };
}

/**
 * UI-state hook for the catalog query builder. Returns only slice state and
 * dispatch helpers — no data fetching. Component callers that also need data
 * should call {@link useCatalogQueryResults}.
 */
export function useCatalogQuerySearch() {
  const dispatch = useAppDispatch();

  const rows = useAppSelector(catalogSlice.selectors.getRows);
  const sortBy = useAppSelector(catalogSlice.selectors.getSortBy);
  const sortOrder = useAppSelector(catalogSlice.selectors.getSortOrder);
  const filters = useAppSelector(catalogSlice.selectors.getFilters);
  const selected = useAppSelector(catalogSlice.selectors.getSelected);

  const addRow = useCallback(
    () => dispatch(catalogSlice.actions.addRow()),
    [dispatch],
  );
  const removeRow = useCallback(
    (id: string) => dispatch(catalogSlice.actions.removeRow(id)),
    [dispatch],
  );
  const updateRow = useCallback(
    (id: string, updates: Partial<CatalogSearchRow>) =>
      dispatch(catalogSlice.actions.updateRow({ id, updates })),
    [dispatch],
  );

  const setSort = useCallback(
    (next: { sortBy: CatalogSortBy; sortOrder: CatalogSortOrder }) =>
      dispatch(catalogSlice.actions.setSort(next)),
    [dispatch],
  );
  const setFilter = useCallback(
    (next: Partial<CatalogFilters>) =>
      dispatch(catalogSlice.actions.setFilter(next)),
    [dispatch],
  );

  const setSelection = useCallback(
    (ids: number[]) => dispatch(catalogSlice.actions.setSelection(ids)),
    [dispatch],
  );
  const addSelection = useCallback(
    (id: number) => dispatch(catalogSlice.actions.addSelection(id)),
    [dispatch],
  );
  const removeSelection = useCallback(
    (id: number) => dispatch(catalogSlice.actions.removeSelection(id)),
    [dispatch],
  );
  const clearSelection = useCallback(
    () => dispatch(catalogSlice.actions.clearSelection()),
    [dispatch],
  );

  const openMobileSearch = useCallback(
    () => dispatch(catalogSlice.actions.openMobileSearch()),
    [dispatch],
  );
  const closeMobileSearch = useCallback(
    () => dispatch(catalogSlice.actions.closeMobileSearch()),
    [dispatch],
  );

  const reset = useCallback(
    () => dispatch(catalogSlice.actions.reset()),
    [dispatch],
  );

  const effectiveQuery = useMemo(() => buildCatalogQuery(rows), [rows]);
  const hasActiveQuery =
    effectiveQuery.length > 0 ||
    filters.genres.length > 0 ||
    filters.formats.length > 0 ||
    filters.tags.length > 0;

  return {
    rows,
    sortBy,
    sortOrder,
    filters,
    selected,
    effectiveQuery,
    hasActiveQuery,
    addRow,
    removeRow,
    updateRow,
    setSort,
    setFilter,
    setSelection,
    addSelection,
    removeSelection,
    clearSelection,
    openMobileSearch,
    closeMobileSearch,
    reset,
    dispatch,
    catalogSlice,
  };
}

export function useCanEditCatalog(): boolean {
  const { data, authenticating } = useAuthentication();
  if (authenticating || !isAuthenticated(data) || !data.user) {
    return false;
  }
  return data.user.authority >= Authorization.MD;
}

/**
 * Data-fetching hook for the catalog query builder. Reads slice state from
 * {@link useCatalogQuerySearch}, fires `/library/query`, and accumulates
 * pages for infinite scroll. Response-based throttling mirrors
 * `usePlaylistSearch` — at most one in-flight request, the next-query queues.
 */
export function useCatalogQueryResults() {
  const { rows, sortBy, sortOrder, filters, effectiveQuery } =
    useCatalogQuerySearch();
  const dispatch = useAppDispatch();
  const page = useAppSelector(catalogSlice.selectors.getPage);

  const { authenticating, authenticated } = useAuthentication();
  const ready = !authenticating && authenticated;

  const params = useMemo(
    () => toLibraryQueryParams(rows, filters, page, sortBy, sortOrder),
    [rows, filters, page, sortBy, sortOrder],
  );

  const pendingQueryRef = useRef<LibraryQueryParams | null>(null);
  // null sentinel — distinguish "never fired" from "fired with empty q"
  const lastFiredRef = useRef<string | null>(null);

  // Accumulated results held in state so a new page or a query-reset triggers
  // a re-render. A ref-based store wouldn't — the Results component reads
  // straight from this hook, and React only re-renders on state changes.
  const [accumulated, setAccumulated] = useState<AlbumEntry[]>([]);
  const lastAccumulatedKeyRef = useRef<string>("");
  const lastPatchedSearchResult = useAppSelector(
    catalogSlice.selectors.getLastPatchedSearchResult,
  );

  const [trigger, { data, isFetching, isError }] =
    useLazySearchLibraryQueryQuery();

  // Reset accumulated rows when the query or sort changes (any param except page).
  useEffect(() => {
    const key = `${effectiveQuery}|${sortBy}|${sortOrder}|${filters.tags.join(",")}|${filters.genres.join(",")}|${filters.formats.join(",")}`;
    if (key !== lastAccumulatedKeyRef.current) {
      lastAccumulatedKeyRef.current = key;
      setAccumulated([]);
    }
  }, [effectiveQuery, sortBy, sortOrder, filters]);

  // Keep paginated in-memory results in sync after a catalog edit save.
  useEffect(() => {
    if (!lastPatchedSearchResult) return;
    setAccumulated((prev) => {
      const index = prev.findIndex(
        (row) => row.id === lastPatchedSearchResult.id,
      );
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = mergeAlbumIntoSearchResult(
        prev[index],
        lastPatchedSearchResult,
      );
      return next;
    });
  }, [lastPatchedSearchResult]);

  // Append the latest page (or replace, for page 0) into the accumulator.
  useEffect(() => {
    if (!data?.results) return;
    setAccumulated((prev) => {
      const base = data.page === 0 ? [] : prev;
      return dedupeAlbumEntriesById([...base, ...data.results]);
    });
  }, [data]);

  // Fire the search when params change. Suppress while any row holds a single-
  // character partial — typing "a" into a field shouldn't fire a query before
  // the user finishes the word. Empty rows don't count as partial.
  useEffect(() => {
    if (!ready) return;
    const hasPartialRow = rows.some((r) => {
      const v = r.value.trim();
      return v.length > 0 && v.length < MIN_QUERY_LENGTH;
    });
    if (hasPartialRow) {
      pendingQueryRef.current = null;
      return;
    }

    const fingerprint = JSON.stringify(params);
    if (isFetching) {
      pendingQueryRef.current = params;
      return;
    }
    if (fingerprint !== lastFiredRef.current) {
      lastFiredRef.current = fingerprint;
      pendingQueryRef.current = null;
      trigger(params);
    }
  }, [params, ready, rows, isFetching, trigger]);

  // Drain pending query once the in-flight request finishes.
  useEffect(() => {
    if (isFetching) return;
    const pending = pendingQueryRef.current;
    if (!pending) return;
    const fingerprint = JSON.stringify(pending);
    if (fingerprint === lastFiredRef.current) {
      pendingQueryRef.current = null;
      return;
    }
    lastFiredRef.current = fingerprint;
    pendingQueryRef.current = null;
    trigger(pending);
  }, [isFetching, trigger]);

  const loadNextPage = useCallback(() => {
    if (!data) return;
    if (data.page + 1 >= data.totalPages) return;
    dispatch(catalogSlice.actions.nextPage());
  }, [data, dispatch]);

  const hasMore = data ? data.page + 1 < data.totalPages : false;

  return {
    results: accumulated,
    total: data?.total ?? 0,
    hasMore,
    isLoading: isFetching,
    isError,
    loadNextPage,
  };
}

// ---------------------------------------------------------------------------
// Flowsheet-autofill hooks — unchanged from the pre-query-builder shape.
// They read from flowsheetSlice and hit the preserved /library/ endpoint via
// catalogApi.searchCatalog. Don't migrate them to /library/query — they don't
// need filters, pagination, or query parsing.
// ---------------------------------------------------------------------------

export const useCatalogFlowsheetSearch = () => {
  const FLOWSHEET_MIN_SEARCH_LENGTH = 2;

  const { authenticating, authenticated } = useAuthentication();
  const flowsheetQuery = useAppSelector(
    flowsheetSlice.selectors.getSearchQuery,
  );

  const { data } = useSearchCatalogQuery(
    {
      artist_name: flowsheetQuery.artist,
      album_title: flowsheetQuery.album,
      n: 10,
    },
    {
      skip:
        authenticating ||
        !authenticated ||
        flowsheetQuery.artist.length + flowsheetQuery.album.length <=
          FLOWSHEET_MIN_SEARCH_LENGTH,
    },
  );

  return {
    searchResults:
      flowsheetQuery.artist.length + flowsheetQuery.album.length >
      FLOWSHEET_MIN_SEARCH_LENGTH
        ? data ?? []
        : [],
  };
};

export const useRotationFlowsheetSearch = () => {
  const FLOWSHEET_MIN_SEARCH_LENGTH = 2;

  const { authenticating, authenticated } = useAuthentication();
  const rotationQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);
  const { data, isLoading, isSuccess } = useGetRotationQuery(undefined, {
    skip: authenticating || !authenticated,
  });

  const searchResults = useMemo(() => {
    if (!data || isLoading || !isSuccess) return [];
    return filterBySearchTerms(data, rotationQuery);
  }, [data, isLoading, isSuccess, rotationQuery]);

  return {
    searchResults:
      rotationQuery.artist.length + rotationQuery.album.length >
      FLOWSHEET_MIN_SEARCH_LENGTH
        ? searchResults
        : [],
    loading: isLoading,
  };
};
