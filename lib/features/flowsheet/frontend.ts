import { createAppSlice } from "@/lib/createAppSlice";
import { PayloadAction } from "@reduxjs/toolkit";
import { FlowsheetFrontendState, FlowsheetQuery } from "./types";

export const defaultFlowsheetFrontendState: FlowsheetFrontendState = {
  autoplay: false,
  search: {
    open: false,
    query: {
      song: "",
      artist: "",
      album: "",
      label: "",
      request: false,
    },
    selectedResult: 0,
  },
  queue: [],
};

export const flowsheetSlice = createAppSlice({
  name: "flowsheet",
  initialState: defaultFlowsheetFrontendState,
  reducers: {
    setAutoplay: (state, action) => {
      state.autoplay = action.payload;
    },
    setSearchOpen: (state, action) => {
      state.search.open = action.payload;
    },
    resetSearch: (state) => {
      state.search.query = defaultFlowsheetFrontendState.search.query;
    },
    setSearchProperty: (
      state,
      action: PayloadAction<{ name: keyof Omit<FlowsheetQuery, "request">; value: string }>
    ) => {
      state.search.query[action.payload.name] = action.payload.value;
    },
    toggleRequest: (state) => {
      state.search.query.request = !state.search.query.request;
    },
    addToQueue: (state, action: PayloadAction<FlowsheetQuery>) => {
      state.queue.push({
        id: state.queue.length,
        play_order: state.queue.length,
        show_id: -1,
        track_title: action.payload.song,
        artist_name: action.payload.artist,
        album_title: action.payload.album,
        record_label: action.payload.label,
        request_flag: action.payload.request,
      })
    },
    removeFromQueue: (state, action) => {
      state.queue = state.queue.filter((entry) => entry.id !== action.payload);
    },
    setSelectedResult: (state, action) => {
      state.search.selectedResult = action.payload;
    },
  },
  selectors: {
    getAutoplay: (state) => state.autoplay,
    getSearchOpen: (state) => state.search.open,
    getSearchQuery: (state) => state.search.query,
    getSearchQueryLength: (state) => Object.values(state.search.query).filter((value) => value).length,
    getQueue: (state) => state.queue,
    getSelectedResult: (state) => state.search.selectedResult,
  },
});
