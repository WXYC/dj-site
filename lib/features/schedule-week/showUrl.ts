/**
 * The URL vocabulary the playlists screen branches on, and the links built
 * from it. Kept out of the hooks module so a results row can build a link
 * without pulling the week's data layer into its bundle.
 */
export const VIEW_PARAM = "view";
export const WEEK_PARAM = "week";
export const SHOW_PARAM = "show";
/** The playcut to highlight; absent when a show was opened from the week grid. */
export const ENTRY_PARAM = "entry";
export const WEEK_VIEW = "week";

/**
 * The DOM id the fragment points at. Prefixed because a bare number is not a
 * valid selector target without escaping.
 */
export function entryAnchorId(entryId: number): string {
  return `entry-${entryId}`;
}

/**
 * A search result's link into the show it was played on.
 *
 * Query-only, so it resolves against whatever path the listing is served on
 * and cannot carry a path that disagrees with it. The fragment is what the
 * router scrolls to when the rows happen to be in hand already; the show view
 * re-scrolls for the usual case, where they arrive after the commit.
 */
export function hrefForShowEntry(showId: number, entryId: number): string {
  return `?${SHOW_PARAM}=${showId}&${ENTRY_PARAM}=${entryId}#${entryAnchorId(entryId)}`;
}
