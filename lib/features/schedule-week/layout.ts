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
 * Height given to a show whose sign-off was never recorded and cannot be
 * inferred. It has to be visible and it must not imply a duration, so it is
 * deliberately far smaller than any real show.
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
function resolveShowEnd(
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

  const endMarkers = new Map<number, number>();
  let unattributedEntryCount = 0;
  for (const e of response.entries as FlowsheetRangeEntry[]) {
    if (e.show_id === null || e.show_id === undefined) {
      unattributedEntryCount++;
      continue;
    }
    if (e.entry_type === "show_end" && e.add_time) {
      endMarkers.set(e.show_id, ms(e.add_time));
    }
  }

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
    return { ...r, endMs: Math.min(r.endMs, Math.max(nextStart, ms(r.show.start_time))) };
  });

  const columns: DayColumn[] = dayBounds.slice(0, 7).map((dayStartMs, i) => {
    const dayEndMs = dayBounds[i + 1];
    const dayLength = dayEndMs - dayStartMs;
    const blocks: ShowBlock[] = [];

    for (const { show, endMs, inferred } of drawn) {
      const startMs = ms(show.start_time);
      const clippedStart = Math.max(startMs, dayStartMs);
      const clippedEnd = Math.min(endMs, dayEndMs);
      if (clippedEnd <= clippedStart) {
        // A zero-length unclosed show still needs to be visible on the day it
        // started, so it is admitted at minimum height rather than dropped.
        const startsToday = startMs >= dayStartMs && startMs < dayEndMs;
        if (!(inferred && startsToday && endMs <= startMs)) continue;
      }

      const top = (clippedStart - dayStartMs) / dayLength;
      const rawHeight = Math.max(clippedEnd - clippedStart, 0) / dayLength;
      const height = Math.max(rawHeight, inferred ? MIN_BLOCK_FRACTION : 0);

      blocks.push({
        showId: show.id,
        djName: show.dj_name ?? null,
        showName: show.show_name ?? null,
        startMs: clippedStart,
        endMs: clippedEnd,
        topFraction: top,
        heightFraction: Math.min(height, 1 - top),
        timeRangeLabel: timeRangeLabel(startMs, endMs, inferred),
        isClipped: startMs < dayStartMs || endMs > dayEndMs,
        endIsInferred: inferred,
      });
    }

    const gaps: Gap[] = [];
    let cursor = 0;
    for (const b of blocks) {
      if (b.topFraction > cursor + 1e-9) {
        gaps.push({ topFraction: cursor, heightFraction: b.topFraction - cursor });
      }
      cursor = Math.max(cursor, b.topFraction + b.heightFraction);
    }
    if (cursor < 1 - 1e-9) {
      gaps.push({ topFraction: cursor, heightFraction: 1 - cursor });
    }

    return { dayStartMs, dayEndMs, blocks, gaps };
  });

  return { columns, unattributedEntryCount };
}
