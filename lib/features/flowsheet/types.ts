/**
 * Flowsheet Types
 *
 * This file now re-exports shared DTOs from @wxyc/shared and adds
 * frontend-specific types that aren't needed by the backend.
 */

// Re-export shared DTOs
export {
  FlowsheetEntryBase,
  FlowsheetEntryResponse,
  FlowsheetSongEntry,
  FlowsheetShowBlockEntry,
  FlowsheetMessageEntry,
  FlowsheetBreakpointEntry,
  FlowsheetEntry,
  FlowsheetCreateRequest,
  FlowsheetUpdateRequest,
  FlowsheetQueryParams,
  OnAirDJ,
  OnAirStatusResponse,
  // Type guards
  isFlowsheetSongEntry,
  isFlowsheetShowBlockEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetMessageEntry,
  isFlowsheetTalksetEntry,
  isFlowsheetBreakpointEntry,
} from "@wxyc/shared/dtos";

export type { DateTimeEntry } from "@wxyc/shared/dtos";

// Import rotation type for frontend-specific types
import type { RotationFrequency } from "@wxyc/shared/dtos";

// ============================================================================
// Frontend-specific types (not shared with backend)
// ============================================================================

/**
 * Frontend state for the flowsheet Redux slice
 */
export type FlowsheetFrontendState = {
  autoplay: boolean;
  search: {
    open: boolean;
    query: FlowsheetQuery;
    selectedResult: number;
  };
  queue: FlowsheetSongEntryLocal[];
  queueIdCounter: number;
  pagination: FlowsheetRequestParams;
  currentShowEntries: FlowsheetEntryLocal[];
};

/**
 * Query state for flowsheet search UI
 */
export type FlowsheetQuery = {
  song: string;
  artist: string;
  album: string;
  label: string;
  request: boolean;
  album_id?: number;
  play_freq?: RotationFrequency;
  rotation_id?: number;
};

export type FlowsheetSearchProperty = keyof Omit<
  FlowsheetQuery,
  "request" | "album_id" | "play_freq" | "rotation_id"
>;

/**
 * Local song entry type with frontend-specific rotation field
 * (backend returns rotation_play_freq, frontend adds rotation object)
 */
export type FlowsheetSongEntryLocal = {
  id: number;
  play_order: number;
  show_id: number;
  track_title: string;
  artist_name: string;
  album_title: string;
  record_label: string;
  request_flag: boolean;
  album_id?: number;
  rotation_id?: number;
  rotation?: {
    play_freq: RotationFrequency;
  };
};

/**
 * Union type for all flowsheet entry types (frontend version)
 */
export type FlowsheetEntryLocal =
  | FlowsheetSongEntryLocal
  | FlowsheetBreakpointEntryLocal
  | FlowsheetShowBlockEntryLocal
  | FlowsheetMessageEntryLocal;

export type FlowsheetShowBlockEntryLocal = {
  id: number;
  play_order: number;
  show_id: number;
  day: string;
  time: string;
  dj_name: string;
  isStart: boolean;
};

export type FlowsheetMessageEntryLocal = {
  id: number;
  play_order: number;
  show_id: number;
  message: string;
};

export type FlowsheetBreakpointEntryLocal = FlowsheetMessageEntryLocal & {
  day: string;
  time: string;
};

/**
 * Pagination parameters for flowsheet requests
 */
export type FlowsheetRequestParams = {
  page: number;
  limit: number;
  max: number;
  deleted?: number;
};

/**
 * Parameters for updating a flowsheet entry
 */
export type FlowsheetUpdateParams = {
  entry_id: number;
  data: UpdateRequestBody;
};

/**
 * Parameters for switching entry position
 */
export type FlowsheetSwitchParams = {
  entry_id: number;
  new_position: number;
};

/**
 * Body for PATCH requests to update entries
 */
export type UpdateRequestBody = Partial<{
  track_title: string;
  artist_name: string;
  album_title: string;
  record_label: string;
  request_flag: boolean;
}>;

// Legacy type aliases for backwards compatibility
export type OnAirDJResponse = OnAirDJ;
export type OnAirDJData = OnAirStatusResponse;
export type FlowsheetSubmissionParams = FlowsheetCreateRequest;
