/**
 * Typed payload builders for `pg_notify('cdc', <json>)` from E2E tests.
 *
 * Mirrors `@wxyc/database`'s `CdcEvent` shape
 * (Backend-Service/shared/database/src/cdc-listener.ts). Backend-Service's
 * `setupMetadataBroadcast` (apps/backend/services/metadata-broadcast/...)
 * filters NOTIFY payloads on:
 *
 *   event.table  === 'flowsheet'
 *   event.action === 'UPDATE'
 *   event.data.metadata_status ∈ TERMINAL_STATUSES
 *   typeof event.data.id === 'number'
 *
 * Anything matching is rebroadcast verbatim as a `liveFs:update` SSE event,
 * which dj-site's listener middleware uses to patch the RTK Query cache.
 *
 * The `data` field is the full flowsheet row — payload shape == row shape.
 * BS-2 is the contract this fixture pins: the broadcast carries the entire
 * row, not just `{id, metadata_status}`. Tests assert that observable fields
 * (e.g., `artwork_url`) render in the DOM after the NOTIFY.
 */

export type TerminalMetadataStatus =
  | "enriched_match"
  | "enriched_no_match"
  | "failed_no_retry";

export type CdcAction = "INSERT" | "UPDATE" | "DELETE";

export type CdcFlowsheetRow = {
  id: number;
  metadata_status?: TerminalMetadataStatus;
  artwork_url?: string;
  release_year?: number;
  album_title?: string;
  artist_name?: string;
  track_title?: string;
  record_label?: string;
  [key: string]: unknown;
};

export type CdcEventPayload = {
  table: string;
  schema: string;
  action: CdcAction;
  data: CdcFlowsheetRow | null;
  timestamp: number;
};

/**
 * Build a CDC UPDATE payload for the `flowsheet` table that BS will broadcast
 * as a `liveFs:update`. `metadata_status` defaults to 'enriched_match' so
 * the payload satisfies the broadcast filter without the caller having to
 * remember.
 */
export function buildFlowsheetUpdatePayload(row: CdcFlowsheetRow): CdcEventPayload {
  return {
    table: "flowsheet",
    schema: "public",
    action: "UPDATE",
    data: {
      ...row,
      metadata_status: row.metadata_status ?? "enriched_match",
    },
    timestamp: Date.now(),
  };
}
