/**
 * The URL vocabulary the playlists screen branches on, and the links built
 * from it.
 *
 * Kept out of the hooks module because the live flowsheet's row wrapper reads
 * `entryAnchorId` and imports nothing else from this feature: `schedule-week`'s
 * `api.ts` calls `createApi` at module scope, a side effect tree-shaking cannot
 * drop, so an import of the hooks module would pull the whole week data layer
 * into the flowsheet bundle. Nothing here imports anything.
 */
export const VIEW_PARAM = "view";
export const WEEK_PARAM = "week";
export const SHOW_PARAM = "show";
/** The playcut to highlight; absent when a show was opened from the week grid. */
export const ENTRY_PARAM = "entry";
export const WEEK_VIEW = "week";

/**
 * A row id read off the URL. A scraped, truncated or otherwise malformed value
 * resolves to "nothing selected" rather than to some other row.
 */
export function positiveIdParam(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The DOM id the fragment points at. Prefixed because a bare number is not a
 * valid selector target without escaping.
 */
export function entryAnchorId(entryId: number): string {
  return `entry-${entryId}`;
}

/**
 * A search result's link into the show it was played on, or null when the play
 * belongs to no show — the backend projects a flowsheet row with a null
 * `show_id` as 0, and no show has that id, so such a play must render unlinked
 * rather than point at a page that can only report the show missing.
 *
 * Query-only, so it resolves against whatever path the listing is served on
 * and cannot carry a path that disagrees with it. The fragment is what the
 * router scrolls to when the rows happen to be in hand already; the show view
 * re-scrolls for the usual case, where they arrive after the commit.
 */
export function hrefForShowEntry(
  showId: number,
  entryId: number
): string | null {
  if (showId <= 0) return null;
  return `?${SHOW_PARAM}=${showId}&${ENTRY_PARAM}=${entryId}#${entryAnchorId(entryId)}`;
}
