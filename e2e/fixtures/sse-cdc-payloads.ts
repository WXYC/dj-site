/**
 * Typed payload builders for `pg_notify('cdc', <json>)` from E2E tests.
 * Mirrors `CdcEvent` from `@wxyc/database`. Backend-Service's
 * `setupMetadataBroadcast` filters on `table === 'flowsheet'`,
 * `action === 'UPDATE'`, terminal `data.metadata_status`, and numeric
 * `data.id`; matching payloads are rebroadcast verbatim as `liveFs:update`.
 */

export type TerminalMetadataStatus =
  | "enriched_match"
  | "enriched_no_match"
  | "failed_no_retry";

export type CdcAction = "INSERT" | "UPDATE" | "DELETE";

/**
 * Mirrors `CdcEvent.data` from `@wxyc/database` — open shape because the
 * CDC pipeline carries the full DB row, not just the fields BS's
 * `filterMetadataUpdate` requires. `id` is required because the dj-site
 * listener routes by it; `metadata_status` because BS's filter rejects
 * anything without a terminal value.
 */
export type CdcFlowsheetRow = {
  id: number;
  metadata_status?: TerminalMetadataStatus;
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
