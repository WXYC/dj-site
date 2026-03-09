import type {
  FlowsheetV2TrackEntry,
  FlowsheetV2ShowStartEntry,
  FlowsheetV2ShowEndEntry,
  FlowsheetV2DJJoinEntry,
  FlowsheetV2DJLeaveEntry,
  FlowsheetV2TalksetEntry,
  FlowsheetV2BreakpointEntry,
  FlowsheetV2MessageEntry,
} from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";

export type FlowsheetFrontendState = {
  autoplay: boolean;
  search: {
    open: boolean;
    query: FlowsheetQuery;
    selectedResult: number;
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
  album_id?: number;
  rotation_bin?: Rotation;
  rotation_id?: number;
};

export type FlowsheetSearchProperty = keyof Omit<
  FlowsheetQuery,
  "request" | "album_id" | "rotation_bin" | "rotation_id"
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
  album_id?: number;
  rotation_id?: number;
  rotation?: Rotation;
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
      rotation_id?: number;
      request_flag: boolean;
      record_label?: string;
      rotation_bin?: Rotation;
    }
  | {
      artist_name: string;
      album_title: string;
      track_title: string;
      request_flag: boolean;
      record_label?: string;
    }
  | {
      message: string;
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
    (entry as FlowsheetMessageEntry).message !== undefined &&
    (entry as FlowsheetMessageEntry).message.includes("Talkset")
  );
}

export function isFlowsheetBreakpointEntry(
  entry: FlowsheetEntry
): entry is FlowsheetBreakpointEntry {
  return (
    (entry as FlowsheetBreakpointEntry).message !== undefined &&
    (entry as FlowsheetBreakpointEntry).message.includes("Breakpoint")
  );
}

export type OnAirDJResponse = {
  id: string; // User ID from better-auth (string)
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
