import { describe, it, expect } from "vitest";
import type {
  FlowsheetRangeResponse,
  FlowsheetRangeShow,
  FlowsheetRangeEntry,
} from "@wxyc/shared";
import {
  buildWeekGrid,
  showSpanIsContained,
  MIN_BLOCK_FRACTION,
} from "@/lib/features/schedule-week/layout";
import {
  startOfStationWeek,
  stationWeekWindow,
} from "@/src/utilities/stationTime";

const WEEK = startOfStationWeek(new Date("2026-08-26T12:00:00Z")); // Sun 08/23 ET
const WINDOW = stationWeekWindow(WEEK);
const HOUR = 3_600_000;

/** ET wall-clock instant on day `d` (0 = Sunday) of the fixture week. */
const at = (d: number, h: number, m = 0) =>
  new Date(WEEK.getTime() + d * 86_400_000 + h * HOUR + m * 60_000).toISOString();

function show(over: Partial<FlowsheetRangeShow> & { id: number }): FlowsheetRangeShow {
  return {
    show_name: null,
    dj_name: "DJ Chowder",
    specialty_id: null,
    start_time: at(0, 0),
    end_time: at(0, 3),
    ...over,
  } as FlowsheetRangeShow;
}

function entry(over: Partial<FlowsheetRangeEntry> & { id: number }): FlowsheetRangeEntry {
  return {
    play_order: 1,
    show_id: 1,
    add_time: at(0, 1),
    entry_type: "track",
    ...over,
  } as unknown as FlowsheetRangeEntry;
}

const res = (
  shows: FlowsheetRangeShow[],
  entries: FlowsheetRangeEntry[] = [],
): FlowsheetRangeResponse => ({ shows, entries }) as FlowsheetRangeResponse;

const NOW = new Date(WEEK.getTime() + 8 * 86_400_000); // after the fixture week

describe("buildWeekGrid", () => {
  it("produces seven columns", () => {
    const { columns } = buildWeekGrid(res([]), WEEK, NOW);
    expect(columns).toHaveLength(7);
  });

  it("places a show inside its own day, measured against that day", () => {
    const { columns } = buildWeekGrid(
      res([show({ id: 1, start_time: at(2, 6), end_time: at(2, 12) })]),
      WEEK,
      NOW,
    );
    expect(columns[2].blocks).toHaveLength(1);
    const b = columns[2].blocks[0];
    expect(b.topFraction).toBeCloseTo(6 / 24, 5);
    expect(b.heightFraction).toBeCloseTo(6 / 24, 5);
    expect(columns[1].blocks).toHaveLength(0);
  });

  it("splits a midnight-spanning show across both columns without losing time", () => {
    const { columns } = buildWeekGrid(
      res([show({ id: 1, start_time: at(1, 22), end_time: at(2, 2) })]),
      WEEK,
      NOW,
    );
    const mon = columns[1].blocks[0];
    const tue = columns[2].blocks[0];

    expect(mon.isClipped).toBe(true);
    expect(tue.isClipped).toBe(true);
    expect(mon.heightFraction).toBeCloseTo(2 / 24, 5);
    expect(tue.heightFraction).toBeCloseTo(2 / 24, 5);
    expect(tue.topFraction).toBeCloseTo(0, 5);
    expect(mon.showId).toBe(tue.showId);
  });

  it("draws overlapping shows as non-overlapping blocks", () => {
    const { columns } = buildWeekGrid(
      res([
        show({ id: 1, start_time: at(3, 6), end_time: at(3, 10) }),
        show({ id: 2, start_time: at(3, 9), end_time: at(3, 12) }),
      ]),
      WEEK,
      NOW,
    );
    const [first, second] = columns[3].blocks;
    expect(first.topFraction + first.heightFraction).toBeLessThanOrEqual(
      second.topFraction + 1e-9,
    );
  });

  it("reports uncovered time as gaps", () => {
    const { columns } = buildWeekGrid(
      res([
        show({ id: 1, start_time: at(4, 0), end_time: at(4, 6) }),
        show({ id: 2, start_time: at(4, 9), end_time: at(4, 24) }),
      ]),
      WEEK,
      NOW,
    );
    expect(columns[4].gaps).toHaveLength(1);
    expect(columns[4].gaps[0].heightFraction).toBeCloseTo(3 / 24, 5);
    expect(columns[4].gaps[0].topFraction).toBeCloseTo(6 / 24, 5);
  });

  describe("a show with no recorded sign-off", () => {
    it("takes its end from the show_end marker when one exists", () => {
      const { columns } = buildWeekGrid(
        res(
          [show({ id: 7, start_time: at(1, 6), end_time: null })],
          [entry({ id: 1, show_id: 7, entry_type: "show_end", add_time: at(1, 9) })],
        ),
        WEEK,
        NOW,
      );
      const b = columns[1].blocks[0];
      expect(b.heightFraction).toBeCloseTo(3 / 24, 5);
      expect(b.endIsInferred).toBe(false);
    });

    it("gets a minimum-height block on a past week, never a run to the end", () => {
      const { columns } = buildWeekGrid(
        res([show({ id: 7, start_time: at(1, 6), end_time: null })]),
        WEEK,
        NOW,
      );
      const b = columns[1].blocks[0];
      expect(b.endIsInferred).toBe(true);
      expect(b.heightFraction).toBeCloseTo(MIN_BLOCK_FRACTION, 5);
      expect(columns[2].blocks).toHaveLength(0);
      expect(columns[6].blocks).toHaveLength(0);
    });

    it("clips to now when the show started earlier in the current day", () => {
      const now = new Date(WEEK.getTime() + 3 * 86_400_000 + 14 * HOUR);
      const { columns } = buildWeekGrid(
        res([show({ id: 7, start_time: at(3, 11), end_time: null })]),
        WEEK,
        now,
      );
      const b = columns[3].blocks[0];
      expect(b.endIsInferred).toBe(true);
      expect(b.heightFraction).toBeCloseTo(3 / 24, 5);
    });
  });

  describe("unattributed entries", () => {
    it("counts entries with no show, and keeps the grid intact", () => {
      const { columns, unattributedEntryCount } = buildWeekGrid(
        res(
          [show({ id: 1, start_time: at(0, 1), end_time: at(0, 4) })],
          [
            entry({ id: 1, show_id: null }),
            entry({ id: 2, show_id: null }),
            entry({ id: 3, show_id: 1 }),
          ],
        ),
        WEEK,
        NOW,
      );
      expect(unattributedEntryCount).toBe(2);
      expect(columns[0].blocks).toHaveLength(1);
    });
  });

  describe("DST weeks", () => {
    it.each([
      ["spring forward", "2026-03-08T12:00:00Z", 23],
      ["fall back", "2026-11-01T12:00:00Z", 25],
    ])("measures the %s Sunday against its own %i-hour length", (_l, instant, hours) => {
      const week = startOfStationWeek(new Date(instant));
      const sixHoursIn = new Date(week.getTime() + 6 * HOUR).toISOString();
      const nineHoursIn = new Date(week.getTime() + 9 * HOUR).toISOString();
      const { columns } = buildWeekGrid(
        res([show({ id: 1, start_time: sixHoursIn, end_time: nineHoursIn })]),
        week,
        new Date(week.getTime() + 30 * 86_400_000),
      );
      const b = columns[0].blocks[0];
      // A 3-hour show is a larger slice of a 23-hour day than a 25-hour one.
      expect(b.heightFraction).toBeCloseTo(3 / hours, 4);
    });
  });
});

describe("showSpanIsContained", () => {
  it("is false for a show that started before the window opened", () => {
    const s = show({
      id: 1,
      start_time: new Date(WINDOW.startMs - 2 * HOUR).toISOString(),
      end_time: new Date(WINDOW.startMs + HOUR).toISOString(),
    });
    expect(
      showSpanIsContained(s, WINDOW.startMs + HOUR, WINDOW),
    ).toBe(false);
  });

  it("is false for a show that runs past the window's end", () => {
    const s = show({ id: 1, start_time: at(6, 22), end_time: null });
    expect(showSpanIsContained(s, WINDOW.endMs + HOUR, WINDOW)).toBe(false);
  });

  it("is true for a show wholly inside the window", () => {
    const s = show({ id: 1, start_time: at(3, 6), end_time: at(3, 9) });
    expect(
      showSpanIsContained(s, new Date(at(3, 9)).getTime(), WINDOW),
    ).toBe(true);
  });
});
