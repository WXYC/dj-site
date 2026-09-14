import { describe, it, expect } from "vitest";
import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";
import {
  countDistinctDeclaredHours,
  rankWeeklyPlays,
  unrankedNewAdds,
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
  it("reproduces the legacy header, legend and row shape", () => {
    const ranked = rankWeeklyPlays(
      [show()],
      [entry({ rotation_id: 1, artist_name: "Doms & Deykers", album_title: "Evidence from a Good Source", record_label: "3024" })],
      1,
    );
    const text = formatWeeklyReport(ranked, WEEK);
    expect(text).toBe(
      "WXYC's Top 1 Records for the week of Sunday 9/6/26 - Saturday 9/12/26:\n" +
        "\n" +
        "Rank (Plays) Artist - 'Title of CD/LP/EP/7-inch' (RECORD LABEL)\n" +
        "---------------------------------------------------------------\n" +
        "1 (1) Doms & Deykers - Evidence from a Good Source (3024)\n",
    );
  });
});

describe("unrankedNewAdds", () => {
  const play = (rotationId: number, artist: string, title: string, label: string) =>
    entry({ rotation_id: rotationId, artist_name: artist, album_title: title, record_label: label });

  const bp = (hourOffset: number) =>
    entry({
      entry_type: "breakpoint",
      radio_hour: new Date(SHOW_START + hourOffset * HOUR).toISOString(),
    });

  // Releases below the cut that were added during the week. Everything else --
  // above the cut, or added before it -- belongs nowhere in this block.
  const ENTRIES = [
    play(1, "Juana Molina", "DOGA", "Sonamos"),
    bp(1),
    play(1, "Juana Molina", "DOGA", "Sonamos"),
    bp(2),
    play(1, "Juana Molina", "DOGA", "Sonamos"),
    play(2, "Grisha Shakhnes", "Ghosts", "DISAPPEARING"),
    play(3, "Cat Power", "Moon Pix", "Matador"),
  ];

  const ADD_DATES = new Map([
    [1, "2026-08-01"], // above the cut anyway
    [2, "2026-09-07"], // added during the week -> a new add
    [3, "2026-08-01"], // below the cut but added earlier -> nowhere
  ]);

  it("lists only below-cut releases added during the week", () => {
    const adds = unrankedNewAdds([show()], ENTRIES, 3, ADD_DATES, WEEK);
    expect(adds.map((a) => a.artist)).toEqual(["Grisha Shakhnes"]);
  });

  it("is empty at a threshold nothing falls below", () => {
    // At 1 every tallied release is already ranked, which is why the legacy
    // report never shows this block for the station's own settings.
    expect(unrankedNewAdds([show()], ENTRIES, 1, ADD_DATES, WEEK)).toEqual([]);
  });
});

describe("formatWeeklyReport with new adds", () => {
  it("matches tubafrenzy byte-for-byte at minimumPlays 3", () => {
    // Expected text lifted verbatim from a run of the real
    // WeeklyPlaylistSummary.toEmailSummaryString(), truncated where the genre
    // charts begin -- not transcribed from reading the Java.
    const ranked = [
      { rotationId: 1, artist: "Juana Molina", title: "DOGA", label: "Sonamos", plays: 6 },
      { rotationId: 2, artist: "Chuquimamani-Condori", title: "Edits", label: "self-released", plays: 4 },
      { rotationId: 3, artist: "Broadcast", title: "The Noise Made by People", label: "Warp", plays: 3 },
    ];
    const newAdds = [
      { rotationId: 4, artist: "Grisha Shakhnes", title: "Ghosts", label: "DISAPPEARING", plays: 2 },
      { rotationId: 5, artist: "Jessica Pratt", title: "On Your Own Love Again", label: "Drag City", plays: 2 },
    ];

    expect(formatWeeklyReport(ranked, WEEK, newAdds)).toBe(
      "WXYC's Top 3 Records for the week of Sunday 9/6/26 - Saturday 9/12/26:\n" +
        "\n" +
        "Rank (Plays) Artist - 'Title of CD/LP/EP/7-inch' (RECORD LABEL)\n" +
        "---------------------------------------------------------------\n" +
        "1 (6) Juana Molina - DOGA (Sonamos)\n" +
        "2 (4) Chuquimamani-Condori - Edits (self-released)\n" +
        "3 (3) Broadcast - The Noise Made by People (Warp)\n" +
        "\n" +
        "Other records that were just added to this week's playlist but are not listed above:\n" +
        "\n" +
        "Grisha Shakhnes - Ghosts (DISAPPEARING)\n" +
        "Jessica Pratt - On Your Own Love Again (Drag City)\n",
    );
  });

  it("omits the block entirely when there are no new adds", () => {
    const ranked = [
      { rotationId: 1, artist: "Cat Power", title: "Moon Pix", label: "Matador", plays: 1 },
    ];
    expect(formatWeeklyReport(ranked, WEEK, [])).not.toContain("Other records");
  });
});
