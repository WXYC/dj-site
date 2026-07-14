import { createAppSlice } from "@/lib/createAppSlice";
import { PayloadAction } from "@reduxjs/toolkit";
import {
  FlowsheetEntry,
  FlowsheetFrontendState,
  FlowsheetQuery,
  FlowsheetSearchFilterDimension,
  FlowsheetSearchFilters,
  FlowsheetSearchProperty,
  FlowsheetSongEntry,
  SelectedMatch,
} from "./types";
import { Rotation } from "../rotation/types";
import { clearQueueFromStorage, loadQueueFromStorage, saveQueueToStorage } from "./queue-storage";

// Drop the catalog-anchored trio (album_id, rotation_id, rotation) from a
// would-be queue entry when album_id isn't a real positive library.id.
// SongEntry's "Play Now" handler (src/components/experiences/modern/flowsheet/
// Entries/SongEntry/SongEntry.tsx) reads entry.album_id directly and bypasses
// convertQueryToSubmission, so without sanitization here a synthesized
// negative id from synthesizeAlbumId (library-unlinked rotation/catalog rows)
// rides the wire and trips BS's `album_id != null` branch → TypeError 500 —
// same shape PR #702 gated for the form-submit path. (dj-site#703)
function withSanitizedAlbumLinkage<
  T extends {
    album_id?: number;
    rotation_id?: number;
    rotation?: Rotation;
  }
>(entry: T): T {
  if (typeof entry.album_id === "number" && entry.album_id > 0) {
    return entry;
  }
  return {
    ...entry,
    album_id: undefined,
    rotation_id: undefined,
    rotation: undefined,
  };
}

export const defaultFlowsheetSearchFilters: FlowsheetSearchFilters = {
  genres: [],
  formats: [],
  rotationTags: [],
};

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
    selectedMatch: null,
    filters: defaultFlowsheetSearchFilters,
  },
  queue: [],
  queueIdCounter: 0,
  isDragging: false,
};

export const flowsheetSlice = createAppSlice({
  name: "flowsheet",
  initialState: defaultFlowsheetFrontendState,
  reducers: {
    setAutoplay: (state, action) => {
      state.autoplay = action.payload;
    },
    restoreDraft: (state, action: PayloadAction<FlowsheetQuery>) => {
      state.search.query = { ...action.payload };
      state.search.open = true;
      state.search.selectedResult = 0;
    },
    setSearchOpen: (state, action) => {
      state.search.open = action.payload;
    },
    resetSearch: (state) => {
      state.search.open = defaultFlowsheetFrontendState.search.open;
      state.search.query = defaultFlowsheetFrontendState.search.query;
      state.search.selectedResult = defaultFlowsheetFrontendState.search.selectedResult;
      state.search.selectedMatch = defaultFlowsheetFrontendState.search.selectedMatch;
      state.search.filters = defaultFlowsheetFrontendState.search.filters;
    },
    setSearchProperty: (
      state,
      action: PayloadAction<{ name: FlowsheetSearchProperty; value: string }>
    ) => {
      state.search.query[action.payload.name] = action.payload.value;
    },
    /**
     * Replace all four user-authored text fields at once. The smart-entry
     * composer parses its raw input into song/artist/album/label and writes
     * them here in a single dispatch, so the existing bin/rotation/catalog/LML
     * search sources — which all read `search.query` — keep working unchanged.
     * Rotation/album linkage fields are left untouched.
     */
    setParsedFields: (
      state,
      action: PayloadAction<{
        song: string;
        artist: string;
        album: string;
        label: string;
      }>
    ) => {
      state.search.query.song = action.payload.song;
      state.search.query.artist = action.payload.artist;
      state.search.query.album = action.payload.album;
      state.search.query.label = action.payload.label;
    },
    /**
     * Record the catalog/rotation result the DJ selected. This does NOT write
     * the result's artist/album/label into the query — that merge is derived
     * (see `buildPendingQuery`) so the DJ's typed text is never clobbered.
     * Changing the selection moves the album anchor, so any picked
     * `track_position` is cleared (symmetric to `setSelectedResult`, #704).
     */
    setSelectedMatch: (state, action: PayloadAction<SelectedMatch>) => {
      state.search.selectedMatch = action.payload;
      state.search.query.track_position = undefined;
    },
    clearSelectedMatch: (state) => {
      state.search.selectedMatch = null;
      state.search.query.track_position = undefined;
    },
    setSearchFilters: (
      state,
      action: PayloadAction<FlowsheetSearchFilters>
    ) => {
      state.search.filters = action.payload;
    },
    toggleSearchFilter: (
      state,
      action: PayloadAction<{
        dimension: FlowsheetSearchFilterDimension;
        value: string;
      }>
    ) => {
      const { dimension, value } = action.payload;
      const current = state.search.filters[dimension] as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      state.search.filters[dimension] = next as never;
    },
    /**
     * Set the picked track's Discogs `release_track.position` (e.g. "A1"). Pass
     * `undefined` to clear — used when the DJ falls back to free-text entry or
     * picks a different release.
     */
    setTrackPosition: (state, action: PayloadAction<string | undefined>) => {
      state.search.query.track_position = action.payload;
    },
    toggleRequest: (state) => {
      state.search.query.request = !state.search.query.request;
    },
    addToQueue: (state, action: PayloadAction<FlowsheetQuery>) => {
      const newId = state.queueIdCounter;
      state.queue.push(
        withSanitizedAlbumLinkage({
          id: newId,
          play_order: state.queue.length,
          show_id: -1,
          track_title: action.payload.song,
          artist_name: action.payload.artist,
          album_title: action.payload.album,
          record_label: action.payload.label,
          request_flag: action.payload.request,
          segue: action.payload.segue,
          rotation: action.payload.rotation_bin,
          rotation_id: action.payload.rotation_id,
          album_id: action.payload.album_id,
        })
      );
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
      state.queue = loadQueueFromStorage().map(withSanitizedAlbumLinkage);
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
    setSelectedResult: (state, action: PayloadAction<number>) => {
      // Each search result is a distinct release; navigating between results
      // moves the album_id anchor, so any previously picked track_position
      // (e.g. "A1") would orphan onto the new release. Idempotent re-selection
      // (e.g. mouseover on the already-highlighted row) preserves a freshly
      // picked position. (dj-site#704)
      if (state.search.selectedResult !== action.payload) {
        state.search.query.track_position = undefined;
      }
      state.search.selectedResult = action.payload;
    },
    /**
     * True while a flowsheet row is being dragged. In Redux so
     * `useFlowsheetPollingInterval` can suspend every query subscriber's
     * polling at once.
     */
    setIsDragging: (state, action: PayloadAction<boolean>) => {
      state.isDragging = action.payload;
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
    getSelectedMatch: (state) => state.search.selectedMatch,
    getSearchFilters: (state) => state.search.filters,
    getIsDragging: (state) => state.isDragging,
  },
});
