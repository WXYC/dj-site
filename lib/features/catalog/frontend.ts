import { createAppSlice } from "@/lib/createAppSlice";
import type { PayloadAction } from "@reduxjs/toolkit";
import type {
  AdminCreateArtistFieldKey,
  AdminCreateArtistFormState,
  CatalogFilters,
  CatalogFrontendState,
  CatalogSearchRow,
  CatalogSortBy,
  CatalogSortOrder,
  LegacyCatalogSearchState,
} from "./types";

export const defaultAdminCreateArtistFormState: AdminCreateArtistFormState = {
  verifications: {
    codeLetters: false,
    codeNumber: false,
    newArtistName: false,
    genreSelected: false,
  },
  required: ["codeLetters", "codeNumber", "newArtistName", "genreSelected"],
};

const createInitialRow = (): CatalogSearchRow => ({
  id: crypto.randomUUID(),
  operator: "AND",
  field: "all",
  value: "",
  exact: false,
});

function createInitialLegacySearchState(): LegacyCatalogSearchState {
  return {
    in: "All",
    query: "",
    genre: "All",
    exclusive: false,
    mobileOpen: false,
    params: {
      n: 10,
      orderBy: "title",
      orderDirection: "asc",
    },
  };
}

export const defaultCatalogFrontendState: CatalogFrontendState = {
  rows: [createInitialRow()],
  sortBy: "album",
  sortOrder: "asc",
  page: 0,
  filters: { onStreaming: undefined, genre: "All", format: "All" },
  selected: [],
  mobileOpen: false,
  adminCatalog: {
    search: createInitialLegacySearchState(),
    results: {
      selected: [],
    },
  },
  adminCreateArtist: defaultAdminCreateArtistFormState,
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
    reset: () => defaultCatalogFrontendState,

    setAdminCatalogSearchQuery: (state, action) => {
      state.adminCatalog.search.query = action.payload;
      state.adminCatalog.search.params.n = 10;
    },
    setAdminCatalogSearchIn: (state, action) => {
      state.adminCatalog.search.in = action.payload;
    },
    setAdminCatalogSearchGenre: (state, action) => {
      state.adminCatalog.search.genre = action.payload;
    },
    setAdminCatalogExclusiveFilter: (state, action) => {
      state.adminCatalog.search.exclusive = action.payload;
    },
    openAdminCatalogMobileSearch: (state) => {
      state.adminCatalog.search.mobileOpen = true;
    },
    closeAdminCatalogMobileSearch: (state) => {
      state.adminCatalog.search.mobileOpen = false;
    },
    setAdminCatalogSelection: (state, action) => {
      state.adminCatalog.results.selected = action.payload;
    },
    addAdminCatalogSelection: (state, action) => {
      state.adminCatalog.results.selected.push(action.payload);
    },
    removeAdminCatalogSelection: (state, action) => {
      state.adminCatalog.results.selected =
        state.adminCatalog.results.selected.filter((id) => id !== action.payload);
    },
    clearAdminCatalogSelection: (state) => {
      state.adminCatalog.results.selected = [];
    },
    adminCatalogLoadMore: (state) => {
      state.adminCatalog.search.params.n += 10;
    },
    setAdminCatalogSearchParams: (state, action) => {
      state.adminCatalog.search.params = {
        ...state.adminCatalog.search.params,
        ...action.payload,
      };
    },

    verifyAdminCreateArtist: (
      state,
      action: PayloadAction<{ key: AdminCreateArtistFieldKey; value: boolean }>
    ) => {
      state.adminCreateArtist.verifications[action.payload.key] =
        action.payload.value;
    },
    resetAdminCreateArtist: (state) => {
      state.adminCreateArtist = {
        verifications: { ...defaultAdminCreateArtistFormState.verifications },
        required: [...defaultAdminCreateArtistFormState.required],
      };
    },
  },
  selectors: {
    getRows: (state) => state.rows,
    getSortBy: (state) => state.sortBy,
    getSortOrder: (state) => state.sortOrder,
    getPage: (state) => state.page,
    getFilters: (state) => state.filters,
    getSelected: (state) => state.selected,
    isMobileSearchOpen: (state) => state.mobileOpen,
    getAdminCreateArtistVerification: (
      state,
      key: AdminCreateArtistFieldKey
    ) => state.adminCreateArtist.verifications[key],
    adminCreateArtistFormComplete: (state) =>
      state.adminCreateArtist.required.every(
        (k) => state.adminCreateArtist.verifications[k]
      ),

    getAdminCatalogSearchQuery: (state) => state.adminCatalog.search.query,
    getAdminCatalogSearchParams: (state) => state.adminCatalog.search.params,
    getAdminCatalogSearchIn: (state) => state.adminCatalog.search.in,
    getAdminCatalogSearchGenre: (state) => state.adminCatalog.search.genre,
    getAdminCatalogExclusiveFilter: (state) =>
      state.adminCatalog.search.exclusive,
    isAdminCatalogMobileSearchOpen: (state) =>
      state.adminCatalog.search.mobileOpen,
    getAdminCatalogSelected: (state) => state.adminCatalog.results.selected,
  },
});
