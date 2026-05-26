"use client";

import {
  useLazySearchLibraryQueryQuery,
  useSearchCatalogQuery,
} from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { isCompilationArtistName } from "@/lib/features/catalog/is-compilation-artist";
import {
  AlbumEntry,
  CatalogFilters,
  CatalogSearchField,
  CatalogSearchRow,
  CatalogSortBy,
  CatalogSortOrder,
  LibraryQueryParams,
} from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthentication } from "./authenticationHooks";
import { filterBySearchTerms } from "@/src/utilities/filterBySearchTerms";

const MIN_QUERY_LENGTH = 2;
const PAGE_LIMIT = 50;

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
 * Map UI state to the request shape. `'All'` enum sentinels become
 * `undefined` so they're omitted from the URL.
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
    on_streaming: filters.onStreaming,
    genre: filters.genre === "All" ? undefined : filters.genre,
    format: filters.format === "All" ? undefined : filters.format,
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
    filters.onStreaming !== undefined ||
    filters.genre !== "All" ||
    filters.format !== "All";

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

  const [trigger, { data, isFetching, isError }] =
    useLazySearchLibraryQueryQuery();

  // Reset accumulated rows when the query or sort changes (any param except page).
  useEffect(() => {
    const key = `${effectiveQuery}|${sortBy}|${sortOrder}|${filters.onStreaming}|${filters.genre}|${filters.format}`;
    if (key !== lastAccumulatedKeyRef.current) {
      lastAccumulatedKeyRef.current = key;
      setAccumulated([]);
    }
  }, [effectiveQuery, sortBy, sortOrder, filters]);

  // Append the latest page (or replace, for page 0) into the accumulator.
  useEffect(() => {
    if (!data?.results) return;
    setAccumulated((prev) => {
      if (data.page === 0) return data.results;
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...data.results.filter((r) => !seen.has(r.id))];
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

  const isCompilationQuery = isCompilationArtistName(flowsheetQuery.artist);

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
        isCompilationQuery ||
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

  const isCompilationQuery = isCompilationArtistName(rotationQuery.artist);

  const searchResults = useMemo(() => {
    if (!data || isLoading || !isSuccess || isCompilationQuery) return [];
    return filterBySearchTerms(data, rotationQuery);
  }, [data, isLoading, isSuccess, rotationQuery, isCompilationQuery]);

  return {
    searchResults:
      rotationQuery.artist.length + rotationQuery.album.length >
      FLOWSHEET_MIN_SEARCH_LENGTH
        ? searchResults
        : [],
    loading: isLoading,
  };
};
