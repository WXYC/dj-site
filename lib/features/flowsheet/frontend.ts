import { createAppSlice } from "@/lib/createAppSlice";
import { PayloadAction } from "@reduxjs/toolkit";
import { FlowsheetEntry, FlowsheetFrontendState, FlowsheetQuery, FlowsheetRequestParams, FlowsheetSearchProperty, FlowsheetSongEntry, FlowsheetSwitchParams } from "./types";
import { clearQueueFromStorage, loadQueueFromStorage, saveQueueToStorage } from "./queue-storage";

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
  queueIdCounter: 0,
  pagination: {
    page: 0,
    limit: 20,
    max: 0
  },
  currentShowEntries: [],
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
      state.search.open = defaultFlowsheetFrontendState.search.open;
      state.search.query = defaultFlowsheetFrontendState.search.query;
      state.search.selectedResult = defaultFlowsheetFrontendState.search.selectedResult;
    },
    setSearchProperty: (
      state,
      action: PayloadAction<{ name: FlowsheetSearchProperty; value: string }>
    ) => {
      state.search.query[action.payload.name] = action.payload.value;
    },
    toggleRequest: (state) => {
      state.search.query.request = !state.search.query.request;
    },
    addToQueue: (state, action: PayloadAction<FlowsheetQuery>) => {
      const newId = state.queueIdCounter;
      state.queue.push({
        id: newId,
        play_order: state.queue.length,
        show_id: -1,
        track_title: action.payload.song,
        artist_name: action.payload.artist,
        album_title: action.payload.album,
        record_label: action.payload.label,
        request_flag: action.payload.request,
        rotation_bin: action.payload.rotation_bin,
        rotation_id: action.payload.rotation_id,
        album_id: action.payload.album_id,
      });
      state.queueIdCounter += 1;
      saveQueueToStorage(state.queue);
    },
    removeFromQueue: (state, action) => {
      state.queue = state.queue.filter((entry) => entry.id !== action.payload);
      saveQueueToStorage(state.queue);
    },
    clearQueue: (state) => {
      state.queue = [];
      state.queueIdCounter = 0;
      clearQueueFromStorage();
    },
    loadQueue: (state) => {
      state.queue = loadQueueFromStorage();
      // Set counter to max ID + 1 to avoid duplicates
      const maxId = state.queue.reduce((max, entry) => Math.max(max, entry.id), -1);
      state.queueIdCounter = maxId + 1;
    },
    updateQueueEntry: (state, action: PayloadAction<{ entry_id: number; field: keyof FlowsheetSongEntry; value: string | boolean }>) => {
      const entry = state.queue.find((e) => e.id === action.payload.entry_id);
      if (entry) {
        (entry as any)[action.payload.field] = action.payload.value;
      }
      saveQueueToStorage(state.queue);
    },
    reorderQueue: (state, action: PayloadAction<FlowsheetSongEntry[]>) => {
      state.queue = action.payload;
      saveQueueToStorage(state.queue);
    },
    setSelectedResult: (state, action) => {
      state.search.selectedResult = action.payload;
    },
    setPage: (state, action) => {
      state.pagination.page = action.payload;
    },
    setPagination: (state, action: PayloadAction<Omit<FlowsheetRequestParams, "max">>) => {
      state.pagination.page = action.payload.page;
      state.pagination.limit = action.payload.limit;
      state.pagination.max = Math.max(state.pagination.max, action.payload.page);
      state.pagination.deleted = action.payload.deleted || state.pagination.deleted;
    },
    setCurrentShowEntries: (state, action: PayloadAction<FlowsheetEntry[]>) => {
      state.currentShowEntries = action.payload;
    },
    reset: () => defaultFlowsheetFrontendState,
  },
  selectors: {
    getAutoplay: (state) => state.autoplay,
    getSearchOpen: (state) => state.search.open,
    getSearchQuery: (state) => state.search.query,
    getSearchQueryLength: (state) => Object.values(state.search.query).filter((value) => value).length,
    getQueue: (state) => state.queue,
    getSelectedResult: (state) => state.search.selectedResult,
    getPagination: (state) => state.pagination,
    getCurrentShowEntries: (state) => state.currentShowEntries,
  },
});
