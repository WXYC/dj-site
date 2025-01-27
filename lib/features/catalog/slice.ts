import { createAppSlice } from "@/lib/createAppSlice";
import { CatalogFrontendState } from "./types";

export const defaultCatalogFrontendState: CatalogFrontendState = {
  search: {
    in: "Both",
    query: "",
    genre: "All",
    mobileOpen: false,
    params: {
      n: 10,
      orderBy: "title",
      orderDirection: "asc",
    },
  },
  results: {
    selected: [],
  },
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
  },
  selectors: {
    getSearchQuery: (state) => state.search.query,
    getSearchParams: (state) => state.search.params,
    getSearchIn: (state) => state.search.in,
    getSearchGenre: (state) => state.search.genre,
    isMobileSearchOpen: (state) => state.search.mobileOpen,
    getSelected: (state) => state.results.selected,
  },
});
