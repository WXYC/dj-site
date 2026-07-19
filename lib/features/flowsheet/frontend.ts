import { createAppSlice } from "@/lib/createAppSlice";
import { PayloadAction } from "@reduxjs/toolkit";
import { FlowsheetFrontendState, FlowsheetQuery, FlowsheetSearchProperty, FlowsheetSongEntry } from "./types";
import { Rotation } from "../rotation/types";
import { hasLinkedAlbumId } from "./linkage";
import { clearQueueFromStorage, loadQueueFromStorage, saveQueueToStorage } from "./queue-storage";

// Drop only a non-positive album_id from a would-be queue entry. SongEntry's
// "Play Now" handler reads entry.album_id directly and bypasses
// convertQueryToSubmission, so without this a synthesized negative id from
// synthesizeAlbumId (library-unlinked rotation/catalog rows) rides the wire
// and trips BS's `album_id != null` branch → getAlbumFromDB(-X) → TypeError.
//
// rotation_id and rotation are NOT album-scoped and must survive: rotation_id
// is a first-class FK that BS persists on the freeform variant, and rotation
// is the local badge field the queue row (and the eventual "Play Now" write)
// carries. A library-unlinked rotation pick — typical of Various-Artists
// compilations — would otherwise lose its rotation linkage the moment it was
// queued, dropping the badge on dj-site/iOS and failing to propagate as
// rotation to the wxyc.info archive. (Mirrors convertQueryToSubmission /
// convertBinToFlowsheet, which forward rotation_id independent of album_id.)
function withSanitizedAlbumLinkage<
  T extends {
    album_id?: number;
    rotation_id?: number;
    rotation?: Rotation;
  }
>(entry: T): T {
  if (hasLinkedAlbumId(entry.album_id)) {
    return entry;
  }
  return {
    ...entry,
    album_id: undefined,
  };
}

export const defaultFlowsheetFrontendState: FlowsheetFrontendState = {
  autoplay: false,
  rotationMode: false,
  search: {
    open: false,
    // Enumerate every FlowsheetQuery field (explicit `undefined` for the
    // optionals) so resetSearch clears them all — even a future path that
    // mutates search.query in place instead of reassigning it. (#645)
    query: {
      song: "",
      artist: "",
      album: "",
      label: "",
      request: false,
      segue: undefined,
      album_id: undefined,
      rotation_bin: undefined,
      rotation_id: undefined,
      track_position: undefined,
    },
    selectedResult: 0,
    confirmedArtist: "",
    resetEpoch: 0,
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
    setRotationMode: (state, action: PayloadAction<boolean>) => {
      state.rotationMode = action.payload;
      if (!action.payload) {
        state.search.query.album_id = undefined;
        state.search.query.rotation_id = undefined;
        state.search.query.rotation_bin = undefined;
        state.search.query.track_position = undefined;
      }
    },
    setRotationMetadata: (
      state,
      action: PayloadAction<{ album_id?: number; rotation_id?: number; rotation_bin?: Rotation }>
    ) => {
      state.search.query.album_id = action.payload.album_id;
      state.search.query.rotation_id = action.payload.rotation_id;
      state.search.query.rotation_bin = action.payload.rotation_bin;
      // track_position references a release_track row on the previous
      // album_id; orphan it on the new album and it points at the wrong
      // release. Symmetric to setRotationMode(false). (dj-site#704)
      state.search.query.track_position = undefined;
    },
    setSearchOpen: (state, action) => {
      state.search.open = action.payload;
    },
    resetSearch: (state) => {
      state.search.open = defaultFlowsheetFrontendState.search.open;
      state.search.query = defaultFlowsheetFrontendState.search.query;
      state.search.selectedResult = defaultFlowsheetFrontendState.search.selectedResult;
      state.search.confirmedArtist = defaultFlowsheetFrontendState.search.confirmedArtist;
      state.search.selectionProvided = undefined;
      // Always forward, never back to default — it is a remount signal
      state.search.resetEpoch += 1;
    },
    setConfirmedArtist: (state, action: PayloadAction<string>) => {
      state.search.confirmedArtist = action.payload;
    },
    setSearchProperty: (
      state,
      action: PayloadAction<{
        name: FlowsheetSearchProperty;
        value: string;
        // Changing a value the selected release supplied deviates from that
        // release: the album linkage (and any picked track position) no
        // longer describes what the DJ is entering, so it must not ride the
        // wire. Filling a field the release left EMPTY is added data, not a
        // deviation — the selection survives.
        deviates?: boolean;
      }>
    ) => {
      const previous = state.search.query[action.payload.name];
      state.search.query[action.payload.name] = action.payload.value;
      // Deviation is judged against what the release supplied at freeze time
      // (selectionProvided), never the rolling query value — per-keystroke
      // edits would otherwise read their own first character as "supplied"
      const provided =
        state.search.selectionProvided?.[
          action.payload.name as "artist" | "album" | "label"
        ];
      if (
        action.payload.deviates &&
        state.search.query.album_id != null &&
        provided === true &&
        previous !== action.payload.value
      ) {
        state.search.query.album_id = undefined;
        state.search.query.rotation_id = undefined;
        state.search.query.rotation_bin = undefined;
        state.search.query.track_position = undefined;
        state.search.selectionProvided = undefined;
      }
    },
    /**
     * Set the picked track's Discogs `release_track.position` (e.g. "A1"). Pass
     * `undefined` to clear — used when the DJ falls back to free-text entry or
     * picks a different release.
     */
    setTrackPosition: (state, action: PayloadAction<string | undefined>) => {
      state.search.query.track_position = action.payload;
    },
    /**
     * Copy a selected search result's fields into the live search query and
     * deselect it, so the user can edit one field without losing the others.
     */
    freezeSelectionToQuery: (
      state,
      action: PayloadAction<{
        artist: string;
        album: string;
        label: string;
        album_id?: number;
        rotation_id?: number;
        rotation_bin?: Rotation;
      }>
    ) => {
      state.search.query.artist = action.payload.artist;
      state.search.query.album = action.payload.album;
      state.search.query.label = action.payload.label;
      state.search.query.album_id = action.payload.album_id;
      state.search.query.rotation_id = action.payload.rotation_id;
      state.search.query.rotation_bin = action.payload.rotation_bin;
      state.search.query.track_position = undefined;
      state.search.selectedResult = 0;
      state.search.selectionProvided = {
        artist: action.payload.artist !== "",
        album: action.payload.album !== "",
        label: action.payload.label !== "",
      };
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
      // Keep the counter strictly ahead of every id in the queue so a future
      // caller that passes entries with ids beyond the current counter can't
      // make a later addToQueue collide. (#646)
      const maxId = action.payload.reduce(
        (max, entry) => Math.max(max, entry.id),
        -1
      );
      state.queueIdCounter = Math.max(state.queueIdCounter, maxId + 1);
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
    getRotationMode: (state) => state.rotationMode,
    getSearchOpen: (state) => state.search.open,
    getSearchQuery: (state) => state.search.query,
    getSearchQueryLength: (state) => Object.values(state.search.query).filter((value) => value).length,
    getQueue: (state) => state.queue,
    getSelectedResult: (state) => state.search.selectedResult,
    getIsDragging: (state) => state.isDragging,
    getConfirmedArtist: (state) => state.search.confirmedArtist,
    getResetEpoch: (state) => state.search.resetEpoch,
  },
});
