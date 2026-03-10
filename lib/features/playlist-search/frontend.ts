import { createAppSlice } from "@/lib/createAppSlice";
import type { PayloadAction } from "@reduxjs/toolkit";
import type {
  PlaylistSearchParamsSortEnum,
  PlaylistSearchParamsOrderEnum,
} from "@wxyc/shared";

type SortField = PlaylistSearchParamsSortEnum;
type SortOrder = PlaylistSearchParamsOrderEnum;
type Operator = "AND" | "OR" | "NOT";
type SearchField = "artist" | "song" | "album" | "label" | "dj" | "date" | "dateRange";

export type SearchRow = {
  id: string;
  operator: Operator;
  field: SearchField;
  value: string;
  valueTo?: string; // For date range "to" value
  exact: boolean;   // Exact phrase match
};

export type SearchMode = "simple" | "advanced";

export type PlaylistSearchState = {
  mode: SearchMode;
  simpleQuery: string;
  advancedRows: SearchRow[];
  sortBy: SortField;
  sortOrder: SortOrder;
  page: number;
};

const createInitialRow = (): SearchRow => ({
  id: crypto.randomUUID(),
  operator: "AND",
  field: "artist",
  value: "",
  exact: false,
});

const initialState: PlaylistSearchState = {
  mode: "simple",
  simpleQuery: "",
  advancedRows: [createInitialRow()],
  sortBy: "date",
  sortOrder: "desc",
  page: 0,
};

export const playlistSearchSlice = createAppSlice({
  name: "playlistSearch",
  initialState,
  reducers: {
    setMode: (state, action: PayloadAction<SearchMode>) => {
      state.mode = action.payload;
      state.page = 0;
    },
    setSimpleQuery: (state, action: PayloadAction<string>) => {
      state.simpleQuery = action.payload;
      state.page = 0;
    },
    addRow: (state) => {
      state.advancedRows.push(createInitialRow());
    },
    removeRow: (state, action: PayloadAction<string>) => {
      if (state.advancedRows.length > 1) {
        state.advancedRows = state.advancedRows.filter(r => r.id !== action.payload);
        state.page = 0;
      }
    },
    updateRow: (state, action: PayloadAction<{ id: string; updates: Partial<SearchRow> }>) => {
      const row = state.advancedRows.find(r => r.id === action.payload.id);
      if (row) {
        Object.assign(row, action.payload.updates);
        state.page = 0;
      }
    },
    setSort: (state, action: PayloadAction<SortField>) => {
      if (state.sortBy === action.payload) {
        state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
      } else {
        state.sortBy = action.payload;
        state.sortOrder = "desc";
      }
      state.page = 0;
    },
    nextPage: (state) => {
      state.page += 1;
    },
    resetPage: (state) => {
      state.page = 0;
    },
    reset: () => initialState,
  },
  selectors: {
    getMode: (state) => state.mode,
    getSimpleQuery: (state) => state.simpleQuery,
    getAdvancedRows: (state) => state.advancedRows,
    getSortBy: (state) => state.sortBy,
    getSortOrder: (state) => state.sortOrder,
    getPage: (state) => state.page,
  },
});
