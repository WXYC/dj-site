import { createAppSlice } from "@/lib/createAppSlice";
import type { PayloadAction } from "@reduxjs/toolkit";
import type {
  AdminCreateArtistFieldKey,
  AdminCreateArtistFormState,
  CatalogFrontendState,
  CatalogSearchState,
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

function createInitialSearchState(): CatalogSearchState {
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
  search: createInitialSearchState(),
  results: {
    selected: [],
  },
  adminCatalog: {
    search: createInitialSearchState(),
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
    setSearchQuery: (state, action) => {
      state.search.query = action.payload;
      state.search.params.n = 10;
    },
    setSearchIn: (state, action) => {
      state.search.in = action.payload;
    },
    setSearchGenre: (state, action) => {
      state.search.genre = action.payload;
    },
    setExclusiveFilter: (state, action) => {
      state.search.exclusive = action.payload;
    },
    openMobileSearch: (state) => {
      state.search.mobileOpen = true;
    },
    closeMobileSearch: (state) => {
      state.search.mobileOpen = false;
    },
    setSelection: (state, action) => {
      state.results.selected = action.payload;
    },
    addSelection: (state, action) => {
      state.results.selected.push(action.payload);
    },
    removeSelection: (state, action) => {
      state.results.selected = state.results.selected.filter(
        (id) => id !== action.payload
      );
    },
    clearSelection: (state) => {
      state.results.selected = [];
    },
    loadMore: (state) => {
      state.search.params.n += 10;
    },
    setSearchParams: (state, action) => {
      state.search.params = {
        ...state.search.params,
        ...action.payload,
      };
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
    getSearchQuery: (state) => state.search.query,
    getSearchParams: (state) => state.search.params,
    getSearchIn: (state) => state.search.in,
    getSearchGenre: (state) => state.search.genre,
    getExclusiveFilter: (state) => state.search.exclusive,
    isMobileSearchOpen: (state) => state.search.mobileOpen,
    getSelected: (state) => state.results.selected,
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
