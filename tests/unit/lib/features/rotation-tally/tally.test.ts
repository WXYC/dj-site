import { describe, it, expect } from "vitest";
import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";
import {
  countDistinctDeclaredHours,
  rankWeeklyPlays,
  formatWeeklyReport,
} from "@/lib/features/rotation-tally/tally";
import { startOfStationWeek } from "@/src/utilities/stationTime";

const WEEK = startOfStationWeek(new Date("2026-09-09T12:00:00Z")); // Sun 09/06 ET
const HOUR = 3_600_000;

// 2026-09-06 20:00 ET, comfortably inside the week and away from any DST edge.
const SHOW_START = Date.parse("2026-09-07T00:00:00Z");

let nextId = 1;
const entry = (o: Partial<FlowsheetRangeEntry>): FlowsheetRangeEntry =>
  ({
    id: nextId++,
    show_id: 1,
    play_order: nextId,
    entry_type: "track",
    add_time: new Date(SHOW_START).toISOString(),
    request_flag: false,
    ...o,
  }) as FlowsheetRangeEntry;

const show = (o: Partial<FlowsheetRangeShow> = {}): FlowsheetRangeShow =>
  ({
    id: 1,
    start_time: new Date(SHOW_START).toISOString(),
    end_time: null,
    ...o,
  }) as FlowsheetRangeShow;

describe("countDistinctDeclaredHours", () => {
  it("counts one play for a record aired twice inside a single declared hour", () => {
    // The legacy figure is COUNT(DISTINCT RADIO_HOUR), not a row count: a
    // record spun twice in one hour is one play on the chart.
    const counts = countDistinctDeclaredHours(
      [show()],
      [
        entry({ rotation_id: 7, play_order: 1 }),
        entry({ rotation_id: 7, play_order: 2 }),
      ],
    );
    expect(counts.get(7)).toBe(1);
  });

  it("advances the bucket on a breakpoint, so the same record counts twice", () => {
    const counts = countDistinctDeclaredHours(
      [show()],
      [
        entry({ rotation_id: 7, play_order: 1 }),
        entry({
          entry_type: "breakpoint",
          play_order: 2,
          radio_hour: new Date(SHOW_START + HOUR).toISOString(),
        }),
        entry({ rotation_id: 7, play_order: 3 }),
      ],
    );
    expect(counts.get(7)).toBe(2);
  });

  it("holds the show's starting hour across a clock hour with no breakpoint", () => {
    // Legacy carried one working hour on every row until a breakpoint moved
    // it. Flooring add_time to the wall clock instead would split this run
    // across two buckets and inflate the count.
    const counts = countDistinctDeclaredHours(
      [show()],
      [
        entry({ rotation_id: 7, play_order: 1 }),
        entry({
          rotation_id: 7,
          play_order: 2,
          add_time: new Date(SHOW_START + 70 * 60_000).toISOString(),
        }),
      ],
    );
    expect(counts.get(7)).toBe(1);
  });

  it("buckets two shows that began in the same hour together", () => {
    // Show start times carry milliseconds. An hour floor that subtracts only
    // minutes and seconds leaves that tail in place, and two shows opening in
    // the same hour then occupy buckets differing by a few milliseconds --
    // counting as two plays for a record that aired once in that hour.
    const counts = countDistinctDeclaredHours(
      [
        show({ id: 1, start_time: "2026-09-10T16:32:48.800Z" }),
        show({ id: 2, start_time: "2026-09-10T16:32:49.353Z" }),
      ],
      [
        entry({ show_id: 1, rotation_id: 7, play_order: 1 }),
        entry({ show_id: 2, rotation_id: 7, play_order: 1 }),
      ],
    );
    expect(counts.get(7)).toBe(1);
  });

  it("ignores entries with no rotation link", () => {
    const counts = countDistinctDeclaredHours(
      [show()],
      [entry({ rotation_id: undefined }), entry({ rotation_id: 0 })],
    );
    expect(counts.size).toBe(0);
  });

  it("keeps each show's bucket separate when two shows interleave by add_time", () => {
    const counts = countDistinctDeclaredHours(
      [show({ id: 1 }), show({ id: 2, start_time: new Date(SHOW_START + HOUR).toISOString() })],
      [
        entry({ show_id: 1, rotation_id: 7, play_order: 1 }),
        entry({ show_id: 2, rotation_id: 7, play_order: 1 }),
      ],
    );
    expect(counts.get(7)).toBe(2);
  });
});

describe("rankWeeklyPlays", () => {
  const named = (rotation_id: number, artist: string, title: string) =>
    entry({ rotation_id, artist_name: artist, album_title: title, record_label: "L" });

  it("sorts by plays desc, then artist, then title -- case-insensitively", () => {
    const entries = [
      named(1, "heavensouls", "b"),
      named(2, "Grupo Um", "a"),
      named(3, "EYE", "c"),
      named(3, "EYE", "c"),
    ];
    const ranked = rankWeeklyPlays([show()], entries, 1);
    expect(ranked.map((r) => r.artist)).toEqual(["EYE", "Grupo Um", "heavensouls"]);
  });

  it("drops rows below the minimum play threshold", () => {
    // Burial needs a breakpoint between its two spins to reach two plays:
    // both inside one declared hour would count once, by design.
    const entries = [
      named(1, "Aybee", "x"),
      named(2, "Burial", "y"),
      entry({
        entry_type: "breakpoint",
        radio_hour: new Date(SHOW_START + HOUR).toISOString(),
      }),
      named(2, "Burial", "y"),
    ];
    const ranked = rankWeeklyPlays([show()], entries, 2);
    expect(ranked.map((r) => r.artist)).toEqual(["Burial"]);
  });
});

describe("formatWeeklyReport", () => {
  it("reproduces the legacy legend and row shape under the station's own header", () => {
    const ranked = rankWeeklyPlays(
      [show()],
      [entry({ rotation_id: 1, artist_name: "Doms & Deykers", album_title: "Evidence from a Good Source", record_label: "3024" })],
      1,
    );
    const text = formatWeeklyReport(ranked, WEEK);
    expect(text).toBe(
      "Airplay Report on WXYC's Top 1 Playbox Records for the week of Sunday 9/6/26 - Saturday 9/12/26:\n" +
        "\n" +
        "Rank (Plays) Artist - 'Title of CD/LP/EP/7-inch' (RECORD LABEL)\n" +
        "---------------------------------------------------------------\n" +
        "1 (1) Doms & Deykers - Evidence from a Good Source (3024)\n",
    );
  });

  it("ends after the last ranked row", () => {
    // The legacy summary followed the chart with a new-adds tail and five genre
    // charts. Neither has been mailed since 2018, so the ranked list is the
    // whole report and the librarian copies it without trimming anything.
    const ranked = [
      { rotationId: 1, artist: "Juana Molina", title: "DOGA", label: "Sonamos", plays: 6 },
      { rotationId: 2, artist: "Chuquimamani-Condori", title: "Edits", label: "self-released", plays: 4 },
      { rotationId: 3, artist: "Broadcast", title: "The Noise Made by People", label: "Warp", plays: 3 },
    ];

    expect(formatWeeklyReport(ranked, WEEK)).toBe(
      "Airplay Report on WXYC's Top 3 Playbox Records for the week of Sunday 9/6/26 - Saturday 9/12/26:\n" +
        "\n" +
        "Rank (Plays) Artist - 'Title of CD/LP/EP/7-inch' (RECORD LABEL)\n" +
        "---------------------------------------------------------------\n" +
        "1 (6) Juana Molina - DOGA (Sonamos)\n" +
        "2 (4) Chuquimamani-Condori - Edits (self-released)\n" +
        "3 (3) Broadcast - The Noise Made by People (Warp)\n",
    );
  });
});
