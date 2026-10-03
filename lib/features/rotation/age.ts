import { utcDateISO } from "@/src/utilities/stationTime";
import { RotationBin, type RotationListRow } from "./types";

const MS_PER_DAY = 86_400_000;

/**
 * Every bin shares one 60-day replacement window until the windows are
 * configurable per bin.
 */
export const ROTATION_WINDOW_DAYS: Record<RotationBin, number> = {
  [RotationBin.H]: 60,
  [RotationBin.M]: 60,
  [RotationBin.L]: 60,
  [RotationBin.S]: 60,
};

/** Parses a bare `YYYY-MM-DD` string as a UTC calendar day, never through local midnight. */
function isoDateToUTCDays(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/**
 * Whole days between `row.rotation_add_date` and today, where "today" is
 * `now`'s UTC calendar day. A bin move is add-then-kill
 * (`addThenRetire.ts`), so a fresh `rotation_add_date` makes this exactly
 * the record's dwell in its current bin.
 *
 * Today is the UTC day, not the station day: for several hours each station
 * evening the UTC day has already turned over to the next calendar day, so
 * differencing a day stamped in UTC against the station day would read
 * negative for anything filed in that window. `rotation_add_date` does not
 * always carry a UTC-stamped day, though -- the classic editor can write a
 * day a person picked at the station into this same column, and a row does
 * not say which kind it holds. Against a station-picked day the UTC-day
 * subtraction is never negative; it only reads one day high during the
 * station's evening, when the UTC day is ahead of the station's, and that
 * is accepted.
 *
 * Both sides parse through `Date.UTC`, which makes the UTC-midnight reading
 * explicit at the call site rather than resting on the engine's date-only
 * parse rule for `new Date("YYYY-MM-DD")`.
 *
 * An unkilled row (`kill_date` cleared) keeps its original `rotation_add_date`,
 * so its age includes the time it spent killed: the row records no unkill
 * date to correct from, and unkilling mostly undoes a recent mistaken kill.
 */
export function daysInBin(row: RotationListRow, now: Date = new Date()): number {
  return isoDateToUTCDays(utcDateISO(now)) - isoDateToUTCDays(row.rotation_add_date);
}

/** Days past `windowDays` for this row's current bin dwell; negative before the window arrives. */
export function daysPastWindow(
  row: RotationListRow,
  windowDays: number,
  now: Date = new Date(),
): number {
  return daysInBin(row, now) - windowDays;
}

/**
 * Whether this row has stayed in its bin longer than `windowDays`. Exactly at
 * the window is not yet overdue. The one boundary rule both a row's chip and
 * the list-wide count read, so the two can never disagree on the day the
 * window ends.
 */
export function isPastWindow(
  row: RotationListRow,
  windowDays: number,
  now: Date = new Date(),
): boolean {
  return daysPastWindow(row, windowDays, now) > 0;
}
