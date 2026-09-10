import { createAppSlice } from "@/lib/createAppSlice";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { PlaylistSearchParams } from "@wxyc/shared/dtos";

export type SortField = PlaylistSearchParams["sort"];
export type SortOrder = PlaylistSearchParams["order"];
type Operator = "AND" | "OR" | "NOT";

export type SearchField =
  | "all"
  | "artist"
  | "song"
  | "album"
  | "label"
  | "dj"
  | "date"
  | "dateRange";

export type SearchRow = {
  id: string;
  operator: Operator;
  field: SearchField;
  value: string;
  valueTo?: string;
  exact: boolean; // Exact phrase match
};

export type PlaylistSearchState = {
  rows: SearchRow[];
  sortBy: SortField;
  sortOrder: SortOrder;
};

const createInitialRow = (): SearchRow => ({
  id: crypto.randomUUID(),
  operator: "AND",
  field: "all",
  value: "",
  exact: false,
});

const initialState: PlaylistSearchState = {
  rows: [createInitialRow()],
  sortBy: "date",
  sortOrder: "desc",
};

export const playlistSearchSlice = createAppSlice({
  name: "playlistSearch",
  initialState,
  reducers: {
    addRow: (state) => {
      state.rows.push({
        ...createInitialRow(),
        field: "artist",
      });
    },
    removeRow: (state, action: PayloadAction<string>) => {
      if (state.rows.length > 1) {
        state.rows = state.rows.filter((r) => r.id !== action.payload);
      }
    },
    updateRow: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<SearchRow> }>,
    ) => {
      const row = state.rows.find((r) => r.id === action.payload.id);
      if (row) {
        Object.assign(row, action.payload.updates);
      }
    },
    // Field and direction arrive as one payload, so a control whose options
    // name a direction can apply it whatever sort it replaces.
    setSort: (
      state,
      action: PayloadAction<{ sortBy: SortField; sortOrder: SortOrder }>,
    ) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    // The column-header idiom: the active column reverses, a new one opens
    // descending.
    toggleSort: (state, action: PayloadAction<SortField>) => {
      if (state.sortBy === action.payload) {
        state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
      } else {
        state.sortBy = action.payload;
        state.sortOrder = "desc";
      }
    },
    reset: () => initialState,
  },
  selectors: {
    getRows: (state) => state.rows,
    getSortBy: (state) => state.sortBy,
    getSortOrder: (state) => state.sortOrder,
  },
});
