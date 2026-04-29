/** Page size for flowsheet list / infinite query (must match backend pagination). */
export const FLOWSHEET_PAGE_SIZE = 20;

/** Shown as `dj_name` until WhoIsLive refetches after join. */
export const FLOWSHEET_OPTIMISTIC_DJ_PLACEHOLDER = "Live";

/** Empty / off-air summary label (keep in sync with API copy). */
export const OFF_AIR_LABEL = "Off Air";

/**
 * Delay before refetching the Flowsheet tag after a successful addToFlowsheet
 * mutation. Backend's `fireAndForgetMetadataForRow` fetches LML metadata
 * (artwork, streaming URLs, artist bio) asynchronously after the row is
 * inserted; the addEntry HTTP response carries the row without that
 * enrichment, so this deferred refetch is what surfaces the metadata on the
 * adding DJ's screen without waiting for the 60s polling cycle. 2000ms
 * covers the typical happy-path LML response (200-800ms) plus margin; on
 * the LML timeout path (5s) the row stays as-rendered with whatever search
 * URLs the backend's fallback supplies. See WXYC/dj-site#476 (option 2)
 * and WXYC/Backend-Service#628.
 */
export const FLOWSHEET_METADATA_REFETCH_DELAY_MS = 2000;
