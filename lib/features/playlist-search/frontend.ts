import { createAppSlice } from "@/lib/createAppSlice";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { PlaylistSearchParams } from "@wxyc/shared/dtos";

type SortField = PlaylistSearchParams["sort"];
type SortOrder = PlaylistSearchParams["order"];
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
  valueTo?: string; // For date range "to" value
  exact: boolean; // Exact phrase match
};

export type PlaylistSearchState = {
  rows: SearchRow[];
  sortBy: SortField;
  sortOrder: SortOrder;
  // Cursor for the next page to fetch. null = first page (start from the
  // most recent entries). The hook reads nextCursor from the previous
  // response and dispatches advanceCursor(nextCursor) on infinite-scroll.
  cursor: string | null;
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
  cursor: null,
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
        state.cursor = null;
      }
    },
    updateRow: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<SearchRow> }>,
    ) => {
      const row = state.rows.find((r) => r.id === action.payload.id);
      if (row) {
        Object.assign(row, action.payload.updates);
        state.cursor = null;
      }
    },
    setSort: (state, action: PayloadAction<SortField>) => {
      if (state.sortBy === action.payload) {
        state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
      } else {
        state.sortBy = action.payload;
        state.sortOrder = "desc";
      }
      state.cursor = null;
    },
    advanceCursor: (state, action: PayloadAction<string>) => {
      state.cursor = action.payload;
    },
    resetCursor: (state) => {
      state.cursor = null;
    },
    reset: () => initialState,
  },
  selectors: {
    getRows: (state) => state.rows,
    getSortBy: (state) => state.sortBy,
    getSortOrder: (state) => state.sortOrder,
    getCursor: (state) => state.cursor,
  },
});
