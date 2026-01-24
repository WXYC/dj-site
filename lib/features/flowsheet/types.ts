/**
 * Flowsheet Types
 *
 * This file now re-exports shared DTOs from @wxyc/shared and adds
 * frontend-specific types that aren't needed by the backend.
 */

// Re-export shared DTOs - types only (no runtime value)
export type {
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
  DateTimeEntry,
} from "@wxyc/shared";

// Re-export type guards (these have runtime values)
export {
  isFlowsheetSongEntry,
  isFlowsheetShowBlockEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetMessageEntry,
  isFlowsheetTalksetEntry,
  isFlowsheetBreakpointEntry,
} from "@wxyc/shared";

// Import types for frontend-specific types
import type {
  RotationBin,
  FlowsheetSongEntry,
  FlowsheetEntry,
  FlowsheetCreateRequest,
  OnAirDJ,
  OnAirStatusResponse,
} from "@wxyc/shared";

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
  queue: FlowsheetSongEntry[];
  queueIdCounter: number;
  pagination: FlowsheetRequestParams;
  currentShowEntries: FlowsheetEntry[];
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
  play_freq?: RotationBin;
  rotation_id?: number;
};

export type FlowsheetSearchProperty = keyof Omit<
  FlowsheetQuery,
  "request" | "album_id" | "play_freq" | "rotation_id"
>;

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
