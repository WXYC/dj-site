import type {
  FlowsheetRangeEntry,
  FlowsheetRangeResponse,
  FlowsheetRangeShow,
} from "@wxyc/shared";
import {
  stationDaysOfWeek,
  stationWeekWindow,
} from "@/src/utilities/stationTime";

/**
 * Height given to a show that would otherwise draw as nothing — its sign-off
 * was never recorded and cannot be inferred, or a neighbour starting at the
 * same instant squeezed its drawn span to zero. It has to be visible and it
 * must not imply a duration, so it is deliberately far smaller than any real
 * show.
 */
export const MIN_BLOCK_FRACTION = 10 / (24 * 60);

export type EpochWindow = { startMs: number; endMs: number };

export type ShowBlock = {
  showId: number;
  djName: string | null;
  showName: string | null;
  /** Clipped to the day column, not the show's true span. */
  startMs: number;
  endMs: number;
  topFraction: number;
  heightFraction: number;
  timeRangeLabel: string;
  /** The show continues outside this column. */
  isClipped: boolean;
  /** `end_time` was null and the drawn end is a best effort, not a record. */
  endIsInferred: boolean;
};

export type Gap = { topFraction: number; heightFraction: number };

export type DayColumn = {
  dayStartMs: number;
  dayEndMs: number;
  blocks: ShowBlock[];
  gaps: Gap[];
};

export type WeekGrid = {
  columns: DayColumn[];
  /**
   * Entries carrying no `show_id`. They cannot be placed on the grid, and the
   * endpoint returns rather than drops them, so a consumer that groups by show
   * has to account for them somewhere.
   */
  unattributedEntryCount: number;
};

const ms = (iso: string) => new Date(iso).getTime();

/**
 * A null `end_time` has two indistinguishable causes: the show is on the air,
 * or its sign-off was dropped and the column stayed null permanently. Reading
 * it as "runs until now" would draw an orphaned show across the rest of its
 * week, so the fallbacks are ordered from most to least evidence.
 */
export function resolveShowEnd(
  show: FlowsheetRangeShow,
  endMarkers: Map<number, number>,
  now: Date,
): { endMs: number; inferred: boolean } {
  if (show.end_time) return { endMs: ms(show.end_time), inferred: false };

  const marker = endMarkers.get(show.id);
  if (marker !== undefined) return { endMs: marker, inferred: false };

  const startMs = ms(show.start_time);
  const nowMs = now.getTime();
  // Only a show that began within the last day and has not yet ended can
  // honestly be drawn as running: anything older is an unclosed record.
  if (startMs <= nowMs && nowMs - startMs < 86_400_000) {
    return { endMs: nowMs, inferred: true };
  }
  return { endMs: startMs, inferred: true };
}

/**
 * Indexes `show_end` markers by show. A show whose `end_time` column stayed
 * null often still has its sign-off recorded as an entry, and that marker is
 * evidence where "now" is only a guess.
 */
export function collectShowEndMarkers(
  entries: readonly FlowsheetRangeEntry[],
): Map<number, number> {
  const endMarkers = new Map<number, number>();
  for (const e of entries) {
    if (e.show_id === null || e.show_id === undefined) continue;
    if (e.entry_type === "show_end" && e.add_time) {
      endMarkers.set(e.show_id, ms(e.add_time));
    }
  }
  return endMarkers;
}

/** Whether a show's whole span sits inside the window that returned it. */
export function showSpanIsContained(
  show: FlowsheetRangeShow,
  resolvedEndMs: number,
  window: EpochWindow,
): boolean {
  return ms(show.start_time) >= window.startMs && resolvedEndMs <= window.endMs;
}

function timeRangeLabel(startMs: number, endMs: number, inferred: boolean): string {
  const fmt = (value: number) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .format(new Date(value))
      .replace(" AM", "a")
      .replace(" PM", "p");
  return inferred ? `${fmt(startMs)}–?` : `${fmt(startMs)}–${fmt(endMs)}`;
}

/**
 * Turns one `/flowsheet/range` week into positioned day columns.
 *
 * Kept free of React so the parts that are actually hard — DST-uneven day
 * lengths, midnight spans, unclosed shows, overlaps — are testable directly.
 */
export function buildWeekGrid(
  response: FlowsheetRangeResponse,
  weekStart: Date,
  now: Date,
): WeekGrid {
  const window = stationWeekWindow(weekStart);
  const days = stationDaysOfWeek(weekStart);
  const dayBounds = [...days.map((d) => d.getTime()), window.endMs];

  const entries = response.entries as FlowsheetRangeEntry[];
  const endMarkers = collectShowEndMarkers(entries);
  const unattributedEntryCount = entries.filter(
    (e) => e.show_id === null || e.show_id === undefined,
  ).length;

  const resolved = [...response.shows]
    .map((show) => ({ show, ...resolveShowEnd(show, endMarkers, now) }))
    .sort((a, b) => ms(a.show.start_time) - ms(b.show.start_time));

  // Overlaps are a sign-on/sign-off artifact rather than two simultaneous
  // shows; clipping to the next start keeps one lane per day, as the grid this
  // replaces did. Only the drawn geometry is affected — entries resolve by
  // show_id, so nothing is hidden by it.
  const drawn = resolved.map((r, i) => {
    const nextStart = resolved[i + 1]
      ? ms(resolved[i + 1].show.start_time)
      : Number.POSITIVE_INFINITY;
    const startMs = ms(r.show.start_time);
    return {
      ...r,
      // What the block occupies in its lane.
      endMs: Math.min(r.endMs, Math.max(nextStart, startMs)),
      // When the show actually stopped. The label, the continues-elsewhere
      // flag and the dead-air sweep all answer questions about the show, not
      // about the lane, and reading the clipped value for them reports a
      // six-hour show as half an hour and its remaining five and a half as
      // dead air.
      trueEndMs: r.endMs,
    };
  });

  const columns: DayColumn[] = dayBounds.slice(0, 7).map((dayStartMs, i) => {
    const dayEndMs = dayBounds[i + 1];
    const dayLength = dayEndMs - dayStartMs;
    const blocks: ShowBlock[] = [];

    for (const { show, endMs, trueEndMs, inferred } of drawn) {
      const startMs = ms(show.start_time);
      const clippedStart = Math.max(startMs, dayStartMs);
      const clippedEnd = Math.min(endMs, dayEndMs);
      const startsToday = startMs >= dayStartMs && startMs < dayEndMs;
      if (clippedEnd <= clippedStart) {
        // A show draws as zero-length two ways: its sign-off was never
        // recorded, or a neighbour signing on at the same instant squeezed
        // its lane to nothing. Both happened, and both have to be visible on
        // the day they began — dropping them is how a real show disappears
        // from the week entirely.
        if (!startsToday) continue;
      }

      const top = (clippedStart - dayStartMs) / dayLength;
      const rawHeight = Math.max(clippedEnd - clippedStart, 0) / dayLength;
      const needsFloor = inferred || rawHeight <= 0;
      const height = Math.max(rawHeight, needsFloor ? MIN_BLOCK_FRACTION : 0);

      blocks.push({
        showId: show.id,
        djName: show.dj_name ?? null,
        showName: show.show_name ?? null,
        startMs: clippedStart,
        endMs: clippedEnd,
        topFraction: top,
        heightFraction: Math.min(height, 1 - top),
        timeRangeLabel: timeRangeLabel(startMs, trueEndMs, inferred),
        isClipped: startMs < dayStartMs || trueEndMs > dayEndMs,
        endIsInferred: inferred,
      });
    }

    // Dead air is a question about the shows, not about the lane. Swept over
    // the drawn blocks, a show clipped short by an overlapping neighbour
    // reports the rest of its run as unprogrammed time, when a DJ was on the
    // air for all of it.
    const covered: Array<[number, number]> = [];
    for (const { show, trueEndMs } of drawn) {
      const from = Math.max(ms(show.start_time), dayStartMs);
      const to = Math.min(trueEndMs, dayEndMs);
      if (to > from) covered.push([from, to]);
    }
    covered.sort((a, b) => a[0] - b[0]);

    const gaps: Gap[] = [];
    let cursorMs = dayStartMs;
    for (const [from, to] of covered) {
      if (from > cursorMs) {
        gaps.push({
          topFraction: (cursorMs - dayStartMs) / dayLength,
          heightFraction: (from - cursorMs) / dayLength,
        });
      }
      cursorMs = Math.max(cursorMs, to);
    }
    if (cursorMs < dayEndMs) {
      gaps.push({
        topFraction: (cursorMs - dayStartMs) / dayLength,
        heightFraction: (dayEndMs - cursorMs) / dayLength,
      });
    }

    return { dayStartMs, dayEndMs, blocks, gaps };
  });

  return { columns, unattributedEntryCount };
}
