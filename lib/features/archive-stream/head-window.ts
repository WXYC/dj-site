import type { FlowsheetRangeEntry } from "@wxyc/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The step after a window that turned up rows, and the width of the head
 * page's first window. */
export const MIN_WINDOW_MS = DAY_MS;

/**
 * How far the head page's first window reaches past the device's clock. A
 * clock running behind the server's would otherwise leave the newest rows out
 * of the listing; nothing is logged in the future, so the reach costs nothing.
 */
export const CLOCK_SKEW_ALLOWANCE_MS = DAY_MS;

/**
 * The walk ends here, not after some run of empty windows, because the
 * archive has real gaps: no rows at all from 2020-04-01 to 2020-05-12 (41.7
 * days), then weekly shows 6.9 days apart through that summer. Any empty-run
 * bound cheap enough to walk would stop at that gap and hide the fifteen years
 * before it. Per-month counts from 2004-11 through 2026-09 found no other
 * month thin enough to hide a gap of more than a few days.
 *
 * The first row (id 154) was logged the evening of 2004-11-03, station time;
 * neither `/flowsheet/search` in date order nor the id sequence has anything
 * older, and `/flowsheet/range` is empty for the 8 days before this floor,
 * which is the UTC midnight preceding that row. Rows backfilled from before it
 * are unreachable until it moves.
 */
export const ARCHIVE_START_MS = Date.UTC(2004, 10, 4);

export type HeadWindow = {
  /** Inclusive lower bound of the `/flowsheet/range` request. */
  start: number;
  /** The moment the window is anchored on -- also the cursor a page that
   * stops here would hand the next one. */
  end: number;
  /** Exclusive upper bound of the `/flowsheet/range` request -- `end` plus
   * `CLOCK_SKEW_ALLOWANCE_MS`. */
  requestEnd: number;
};

/**
 * The head page's first `/flowsheet/range` window: anchored on `now`, one
 * `MIN_WINDOW_MS` wide, reaching `CLOCK_SKEW_ALLOWANCE_MS` past `now`. The
 * reader's `queryFn` and the server seed both call this so a server-rendered
 * seed requests the same window the client's first page does.
 */
export function computeHeadWindow(now: number): HeadWindow {
  return {
    start: Math.max(now - MIN_WINDOW_MS, ARCHIVE_START_MS),
    end: now,
    requestEnd: now + CLOCK_SKEW_ALLOWANCE_MS,
  };
}

/**
 * Newest first by `add_time`, then by `id` -- the reverse of a
 * `/flowsheet/range` window's wire order.
 */
export function orderNewestFirst(entries: FlowsheetRangeEntry[]): FlowsheetRangeEntry[] {
  return [...entries].reverse();
}
