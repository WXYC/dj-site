import { createAppSlice } from "@/lib/createAppSlice";
import type { PayloadAction } from "@reduxjs/toolkit";
import type {
  AlbumEntry,
  CatalogAlbumRotation,
  CatalogFilters,
  CatalogFrontendState,
  CatalogSearchRow,
  CatalogSortBy,
  CatalogSortOrder,
} from "./types";

/** Stable id for the primary row so SSR and client hydration agree on React keys. */
export const CATALOG_PRIMARY_ROW_ID = "catalog-search-primary";

const createInitialRow = (id?: string): CatalogSearchRow => ({
  id: id ?? crypto.randomUUID(),
  operator: "AND",
  field: "all",
  value: "",
  exact: false,
});

export const defaultCatalogFrontendState: CatalogFrontendState = {
  rows: [createInitialRow(CATALOG_PRIMARY_ROW_ID)],
  sortBy: "album",
  sortOrder: "asc",
  filters: { genres: [], formats: [], tags: [] },
  selected: [],
  mobileOpen: false,
  browseEngaged: false,
  lastPatchedSearchResult: null,
  rotationByAlbumId: {},
};

export const catalogSlice = createAppSlice({
  name: "catalog",
  initialState: defaultCatalogFrontendState,
  reducers: {
    addRow: (state) => {
      state.rows.push({ ...createInitialRow(), field: "artist" });
    },
    removeRow: (state, action: PayloadAction<string>) => {
      if (state.rows.length > 1) {
        state.rows = state.rows.filter((r) => r.id !== action.payload);
      }
    },
    updateRow: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<CatalogSearchRow> }>,
    ) => {
      const row = state.rows.find((r) => r.id === action.payload.id);
      if (row) {
        Object.assign(row, action.payload.updates);
      }
    },
    setSort: (
      state,
      action: PayloadAction<{ sortBy: CatalogSortBy; sortOrder: CatalogSortOrder }>,
    ) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    setFilter: (state, action: PayloadAction<Partial<CatalogFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
      if (action.payload.tags !== undefined) {
        state.rotationByAlbumId = {};
      }
    },
    setSelection: (state, action: PayloadAction<number[]>) => {
      state.selected = action.payload;
    },
    addSelection: (state, action: PayloadAction<number>) => {
      state.selected.push(action.payload);
    },
    removeSelection: (state, action: PayloadAction<number>) => {
      state.selected = state.selected.filter((id) => id !== action.payload);
    },
    clearSelection: (state) => {
      state.selected = [];
    },
    openMobileSearch: (state) => {
      state.mobileOpen = true;
    },
    closeMobileSearch: (state) => {
      state.mobileOpen = false;
    },
    engageBrowse: (state) => {
      state.browseEngaged = true;
    },
    patchSearchResult: (state, action: PayloadAction<AlbumEntry>) => {
      state.lastPatchedSearchResult = action.payload;
    },
    setAlbumRotation: (
      state,
      action: PayloadAction<{ albumId: number } & CatalogAlbumRotation>,
    ) => {
      const { albumId, rotation_bin, rotation_id } = action.payload;
      state.rotationByAlbumId[albumId] = { rotation_bin, rotation_id };
    },
    clearAlbumRotation: (state, action: PayloadAction<number>) => {
      delete state.rotationByAlbumId[action.payload];
    },
    reset: () => defaultCatalogFrontendState,
  },
  selectors: {
    getRows: (state) => state.rows,
    getSortBy: (state) => state.sortBy,
    getSortOrder: (state) => state.sortOrder,
    getFilters: (state) => state.filters,
    getSelected: (state) => state.selected,
    isMobileSearchOpen: (state) => state.mobileOpen,
    getBrowseEngaged: (state) => state.browseEngaged,
    getLastPatchedSearchResult: (state) => state.lastPatchedSearchResult,
    getAlbumRotation: (state, albumId: number) =>
      state.rotationByAlbumId[albumId],
  },
});
