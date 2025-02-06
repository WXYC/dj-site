import { Rotation } from "../catalog/types";

export type FlowsheetFrontendState = {
  autoplay: boolean;
  search: {
    open: boolean;
    query: FlowsheetQuery;
    selectedResult: number;
  };
  queue: FlowsheetSongEntry[];
  pagination: FlowsheetRequestParams;
};

export type FlowsheetQuery = {
  song: string;
  artist: string;
  album: string;
  label: string;
  request: boolean;
};

export type FlowsheetEntryBase = {
  id: number;
  play_order: number;
  show_id: number;
};

export type FlowsheetEntryResponse = FlowsheetEntryBase & {
  album_id?: number;
  track_title?: string;
  album_title?: string;
  artist_name?: string;
  record_label?: string;
  rotation_id?: number;
  rotation_play_freq?: string;
  message?: string;
  request_flag: boolean;
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

export type FlowsheetStartShowEntry = FlowsheetEntryBase & {
  dj_name: string;
  date_string: string;
};

export type FlowsheetMessageEntry = FlowsheetEntryBase & {
  message: string;
};

export type FlowsheetEndShowEntry = FlowsheetEntryBase & {
  date_string: string;
};

export type FlowsheetSubmissionParams =
  | {
      album_id: number;
      track_title: string;
      rotation_id?: number;
      request_flag: boolean;
      record_label?: string;
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
  | FlowsheetStartShowEntry
  | FlowsheetEndShowEntry
  | FlowsheetMessageEntry;

export function isFlowsheetSongEntry(
  entry: FlowsheetEntry
): entry is FlowsheetSongEntry {
  return (entry as FlowsheetSongEntry).track_title !== undefined;
}

export function isFlowsheetStartShowEntry(
  entry: FlowsheetEntry
): entry is FlowsheetStartShowEntry {
  return (entry as FlowsheetStartShowEntry).dj_name !== undefined;
}

export function isFlowsheetEndShowEntry(
  entry: FlowsheetEntry
): entry is FlowsheetEndShowEntry {
  return (entry as FlowsheetEndShowEntry).date_string !== undefined;
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
): entry is FlowsheetMessageEntry {
  return (
    (entry as FlowsheetMessageEntry).message !== undefined &&
    (entry as FlowsheetMessageEntry).message.includes("Breakpoint")
  );
}

export type OnAirDJResponse = {
  id: number;
  dj_name: string;
};

export type FlowsheetRequestParams = {
  page: number;
  limit: number;
  max: number;
};
