import type {
  FlowsheetV2TrackEntry,
  FlowsheetV2ShowStartEntry,
  FlowsheetV2ShowEndEntry,
  FlowsheetV2DJJoinEntry,
  FlowsheetV2DJLeaveEntry,
  FlowsheetV2TalksetEntry,
  FlowsheetV2BreakpointEntry,
  FlowsheetV2MessageEntry,
  FlowsheetEntryType,
} from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";

/**
 * A serializable snapshot of a catalog/rotation result the DJ selected in the
 * smart-entry composer. It carries the linkage the submission needs plus the
 * display metadata the "Selected match" row shows (format, artwork, catalog
 * code). Unlike the old `stageRelease` path it does NOT overwrite the typed
 * artist/album/label in the query — the merge into the effective entry is
 * derived (see `buildPendingQuery`), preserving the distinction between what
 * the DJ typed and what the result supplies.
 */
export type SelectedMatch = {
  /** AlbumEntry.id — may be a synthesized negative id for unlinked rows. */
  id: number;
  /** Real library id, present only when the row is linked (id > 0). */
  album_id?: number;
  rotation_id?: number;
  rotation_bin?: Rotation;
  artist: string;
  album: string;
  label: string;
  format?: string;
  on_streaming?: boolean;
  artwork_url?: string | null;
  lettercode?: string;
  numbercode?: number;
  genre?: string;
  entry?: number;
};

/** Flowsheet-owned result filters (independent of the catalog slice). */
export type FlowsheetSearchFilters = {
  genres: string[];
  formats: string[];
  rotationTags: Rotation[];
};

export type FlowsheetSearchFilterDimension = keyof FlowsheetSearchFilters;

export type FlowsheetFrontendState = {
  autoplay: boolean;
  search: {
    open: boolean;
    query: FlowsheetQuery;
    selectedResult: number;
    selectedMatch: SelectedMatch | null;
    filters: FlowsheetSearchFilters;
  };
  queue: FlowsheetSongEntry[];
  queueIdCounter: number;
  currentShowEntries: FlowsheetEntry[];
};

export type FlowsheetQuery = {
  song: string;
  artist: string;
  album: string;
  label: string;
  request: boolean;
  segue?: boolean;
  album_id?: number;
  rotation_bin?: Rotation;
  rotation_id?: number;
  /**
   * Discogs `release_track.position` for the picked track (e.g. "A1", "B3",
   * "1-12"). Free-form vinyl side / multi-disc string — TEXT not INT. Stays
   * undefined when the DJ types track title as free text instead of picking
   * from the tracklist dropdown.
   */
  track_position?: string;
};

export type FlowsheetSearchProperty = keyof Omit<
  FlowsheetQuery,
  "request" | "segue" | "album_id" | "rotation_bin" | "rotation_id"
>;

export type FlowsheetEntryBase = {
  id: number;
  play_order: number;
  show_id: number;
};

export type FlowsheetSongBase = {
  track_title: string;
  artist_name: string;
  album_title: string;
  record_label: string;
  request_flag: boolean;
  segue?: boolean;
  album_id?: number;
  rotation_id?: number;
  rotation?: Rotation;
  on_streaming?: boolean;
  artwork_url?: string;
};

export type FlowsheetSongEntry = FlowsheetEntryBase & FlowsheetSongBase;

export type FlowsheetShowBlockEntry = FlowsheetEntryBase &
  DateTimeEntry & {
    dj_name: string;
    isStart: boolean;
  };

export type FlowsheetMessageEntry = FlowsheetEntryBase & {
  message: string;
};

export type DateTimeEntry = {
  day: string;
  time: string;
};

export type FlowsheetBreakpointEntry = FlowsheetMessageEntry & DateTimeEntry;

export type FlowsheetSubmissionParams =
  | {
      album_id: number;
      track_title: string;
      track_position?: string;
      rotation_id?: number;
      request_flag: boolean;
      segue?: boolean;
      record_label?: string;
      rotation_bin?: Rotation;
    }
  | {
      artist_name: string;
      album_title: string;
      track_title: string;
      track_position?: string;
      request_flag: boolean;
      segue?: boolean;
      record_label?: string;
      // BS#1308 / @wxyc/shared 1.9.0 added rotation_id to
      // FlowsheetCreateSongFreeform so library-unlinked rotation rows
      // preserve rotation linkage on the wire (and the iOS V2 reader's
      // rotation-artwork path can resolve them). Mirrors the canonical
      // type; consumers in bin/conversions.ts forward it when album_id
      // can't be sent.
      rotation_id?: number;
    }
  | {
      message: string;
      entry_type?: FlowsheetEntryType;
    };

export type FlowsheetEntry =
  | FlowsheetSongEntry
  | FlowsheetBreakpointEntry
  | FlowsheetShowBlockEntry
  | FlowsheetMessageEntry;

export function isFlowsheetSongEntry(
  entry: FlowsheetEntry
): entry is FlowsheetSongEntry {
  return (entry as FlowsheetSongEntry).track_title !== undefined;
}

export function isFlowsheetStartShowEntry(
  entry: FlowsheetEntry
): entry is FlowsheetShowBlockEntry {
  return (
    (entry as FlowsheetShowBlockEntry).dj_name !== undefined &&
    (entry as FlowsheetShowBlockEntry).isStart === true
  );
}

export function isFlowsheetEndShowEntry(
  entry: FlowsheetEntry
): entry is FlowsheetShowBlockEntry {
  return (
    (entry as FlowsheetShowBlockEntry).dj_name !== undefined &&
    (entry as FlowsheetShowBlockEntry).isStart === false
  );
}

export function isFlowsheetTalksetEntry(
  entry: FlowsheetEntry
): entry is FlowsheetMessageEntry {
  return (
    (entry as FlowsheetMessageEntry).message != null &&
    (entry as FlowsheetMessageEntry).message.includes("Talkset")
  );
}

export function isFlowsheetBreakpointEntry(
  entry: FlowsheetEntry
): entry is FlowsheetBreakpointEntry {
  return (
    (entry as FlowsheetBreakpointEntry).message != null &&
    (entry as FlowsheetBreakpointEntry).message.includes("Breakpoint")
  );
}

export type OnAirDJResponse = {
  // better-auth user id (string) for account DJs; null for legacy/tubafrenzy
  // shows whose on-air DJ has no Backend-Service account (BS#1547). The banner
  // keys on dj_name, so a null id is display-irrelevant.
  id: string | null;
  dj_name: string;
};

export type OnAirDJData = {
  djs: OnAirDJResponse[];
  onAir: string;
};

export type FlowsheetRequestParams = {
  page: number;
  limit: number;
  max: number;
  deleted?: number;
};

export type FlowsheetUpdateParams = {
  entry_id: number;
  data: UpdateRequestBody;
};

export type FlowsheetSwitchParams = {
  entry_id: number;
  new_position: number;
};

export type UpdateRequestBody = Partial<
  Record<
    keyof Omit<FlowsheetSongBase, "album_id" | "rotation_id" | "rotation">,
    string | boolean
  >
>;

// V2 JSON boundary types (Date fields arrive as strings over the wire)

/** Replaces Date fields with string for JSON boundary */
type JSONDates<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K];
};

export type FlowsheetV2TrackEntryJSON = JSONDates<FlowsheetV2TrackEntry>;
export type FlowsheetV2ShowStartEntryJSON = JSONDates<FlowsheetV2ShowStartEntry>;
export type FlowsheetV2ShowEndEntryJSON = JSONDates<FlowsheetV2ShowEndEntry>;
export type FlowsheetV2DJJoinEntryJSON = JSONDates<FlowsheetV2DJJoinEntry>;
export type FlowsheetV2DJLeaveEntryJSON = JSONDates<FlowsheetV2DJLeaveEntry>;
export type FlowsheetV2TalksetEntryJSON = JSONDates<FlowsheetV2TalksetEntry>;
export type FlowsheetV2BreakpointEntryJSON = JSONDates<FlowsheetV2BreakpointEntry>;
export type FlowsheetV2MessageEntryJSON = JSONDates<FlowsheetV2MessageEntry>;

export type FlowsheetV2EntryJSON =
  | FlowsheetV2TrackEntryJSON
  | FlowsheetV2ShowStartEntryJSON
  | FlowsheetV2ShowEndEntryJSON
  | FlowsheetV2DJJoinEntryJSON
  | FlowsheetV2DJLeaveEntryJSON
  | FlowsheetV2TalksetEntryJSON
  | FlowsheetV2BreakpointEntryJSON
  | FlowsheetV2MessageEntryJSON;

export type FlowsheetV2PaginatedResponseJSON = {
  entries: FlowsheetV2EntryJSON[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type SuggestTrackResult = {
  track_title: string;
  album_title: string | null;
  record_label: string | null;
};

export type TrackDetailsResult = {
  album_title: string | null;
  record_label: string | null;
};
