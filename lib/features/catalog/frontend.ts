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

const createInitialRow = (): CatalogSearchRow => ({
  id: crypto.randomUUID(),
  operator: "AND",
  field: "all",
  value: "",
  exact: false,
});

export const defaultCatalogFrontendState: CatalogFrontendState = {
  rows: [createInitialRow()],
  sortBy: "album",
  sortOrder: "asc",
  page: 0,
  filters: { onStreaming: undefined, genre: "All", format: "All" },
  selected: [],
  mobileOpen: false,
  lastPatchedSearchResult: null,
  rotationByAlbumId: {},
};

export const catalogSlice = createAppSlice({
  name: "catalog",
  initialState: defaultCatalogFrontendState,
  reducers: {
    addRow: (state) => {
      state.rows.push({ ...createInitialRow(), field: "artist" });
      state.page = 0;
    },
    removeRow: (state, action: PayloadAction<string>) => {
      if (state.rows.length > 1) {
        state.rows = state.rows.filter((r) => r.id !== action.payload);
        state.page = 0;
      }
    },
    updateRow: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<CatalogSearchRow> }>,
    ) => {
      const row = state.rows.find((r) => r.id === action.payload.id);
      if (row) {
        Object.assign(row, action.payload.updates);
        state.page = 0;
      }
    },
    setSort: (
      state,
      action: PayloadAction<{ sortBy: CatalogSortBy; sortOrder: CatalogSortOrder }>,
    ) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
      state.page = 0;
    },
    setFilter: (state, action: PayloadAction<Partial<CatalogFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.page = 0;
    },
    nextPage: (state) => {
      state.page += 1;
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
    getPage: (state) => state.page,
    getFilters: (state) => state.filters,
    getSelected: (state) => state.selected,
    isMobileSearchOpen: (state) => state.mobileOpen,
    getLastPatchedSearchResult: (state) => state.lastPatchedSearchResult,
    getAlbumRotation: (state, albumId: number) =>
      state.rotationByAlbumId[albumId],
  },
});
