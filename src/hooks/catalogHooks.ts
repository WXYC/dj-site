"use client";

import {
  useSearchCatalogQuery,
  useSearchLibraryQueryInfiniteQuery,
  type CatalogInfiniteQueryArg,
} from "@/lib/features/catalog/api";
import { CATALOG_QUERY_PAGE_LIMIT } from "@/lib/features/catalog/constants";
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
import { useCallback, useMemo } from "react";
import { useAuthentication } from "./authenticationHooks";
import { filterBySearchTerms } from "@/src/utilities/filterBySearchTerms";
import { catalogTagsToQueryFlags } from "@/src/components/experiences/modern/catalog/Search/catalogTagFilters";

const MIN_QUERY_LENGTH = 2;

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
  const tagFlags = catalogTagsToQueryFlags(filters.tags);
  return {
    q: q || undefined,
    page,
    limit: CATALOG_QUERY_PAGE_LIMIT,
    sort: sortBy,
    order: sortOrder,
    on_streaming: tagFlags.on_streaming,
    missing: tagFlags.missing,
    genres:
      filters.genres.length > 0 ? filters.genres.join(",") : undefined,
    formats:
      filters.formats.length > 0 ? filters.formats.join(",") : undefined,
  };
}

/** Build infinite-query args (page/limit are supplied by RTK `pageParam`). */
export function toCatalogInfiniteQueryArg(
  rows: CatalogSearchRow[],
  filters: CatalogFilters,
  sortBy: CatalogSortBy,
  sortOrder: CatalogSortOrder,
): CatalogInfiniteQueryArg {
  const { page: _page, limit: _limit, ...rest } = toLibraryQueryParams(
    rows,
    filters,
    0,
    sortBy,
    sortOrder,
  );
  return rest;
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
  const browseEngaged = useAppSelector(catalogSlice.selectors.getBrowseEngaged);
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

  const engageBrowse = useCallback(
    () => dispatch(catalogSlice.actions.engageBrowse()),
    [dispatch],
  );

  const reset = useCallback(
    () => dispatch(catalogSlice.actions.reset()),
    [dispatch],
  );

  const effectiveQuery = useMemo(() => buildCatalogQuery(rows), [rows]);
  const hasFilterOrSearch =
    effectiveQuery.length > 0 ||
    filters.genres.length > 0 ||
    filters.formats.length > 0 ||
    filters.tags.length > 0;
  const hasActiveQuery = browseEngaged || hasFilterOrSearch;

  return {
    rows,
    sortBy,
    sortOrder,
    filters,
    browseEngaged,
    selected,
    effectiveQuery,
    hasActiveQuery,
    hasFilterOrSearch,
    engageBrowse,
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
 * Data-fetching hook for the catalog query builder. Uses RTK infinite query
 * on `/library/query` (same pattern as flowsheet `getInfiniteEntries`).
 */
export function useCatalogQueryResults() {
  const { rows, sortBy, sortOrder, filters, hasActiveQuery } =
    useCatalogQuerySearch();

  const { authenticating, authenticated } = useAuthentication();
  const ready = !authenticating && authenticated;

  const hasPartialRow = useMemo(
    () =>
      rows.some((r) => {
        const v = r.value.trim();
        return v.length > 0 && v.length < MIN_QUERY_LENGTH;
      }),
    [rows],
  );

  const queryArg = useMemo(
    () => toCatalogInfiniteQueryArg(rows, filters, sortBy, sortOrder),
    [rows, filters, sortBy, sortOrder],
  );

  const queryEnabled = ready && hasActiveQuery && !hasPartialRow;

  const {
    data,
    isFetching,
    isError,
    hasNextPage,
    fetchNextPage,
  } = useSearchLibraryQueryInfiniteQuery(queryArg, {
    skip: !queryEnabled,
  });

  const results = useMemo(() => {
    if (!data?.pages?.length) return [];
    return dedupeAlbumEntriesById(
      data.pages.flatMap((page) => page.results),
    );
  }, [data?.pages]);

  const total = data?.pages?.[0]?.total ?? 0;
  const isLoadingInitial = isFetching && !data?.pages?.length;
  const isFetchingMore = isFetching && (data?.pages?.length ?? 0) > 0;

  return {
    results,
    total,
    hasNextPage: hasNextPage ?? false,
    isLoadingInitial,
    isFetchingMore,
    isError,
    fetchNextPage,
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
