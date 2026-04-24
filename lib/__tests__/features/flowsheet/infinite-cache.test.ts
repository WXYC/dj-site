import { describe, it, expect } from "vitest";
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import {
  buildOptimisticEntry,
  compareEntriesNewestFirst,
  insertEntrySortedFirstPage,
  maxPlayOrder,
  primaryShowId,
  removeEntryById,
  replaceEntryIdAllPages,
  swapPlayOrdersForSwitch,
} from "@/lib/features/flowsheet/infinite-cache";

function song(
  id: number,
  play_order: number,
  show_id: number
): FlowsheetSongEntry {
  return {
    id,
    play_order,
    show_id,
    track_title: `t${id}`,
    artist_name: "a",
    album_title: "al",
    record_label: "",
    request_flag: false,
  };
}

describe("compareEntriesNewestFirst", () => {
  it("should sort real entries by id descending (higher id = newer)", () => {
    const entries = [song(5, 1, 1), song(10, 2, 1), song(1, 3, 1)];
    entries.sort(compareEntriesNewestFirst);
    expect(entries.map((e) => e.id)).toEqual([10, 5, 1]);
  });

  it("should sort correctly across shows where play_order resets", () => {
    // Current show: play_orders 1-3, ids 100-102
    // Previous show: play_orders 10-12, ids 90-92
    // play_order DESC would wrongly put previous show first
    const entries = [
      song(102, 3, 2), // current show
      song(101, 2, 2),
      song(100, 1, 2),
      song(92, 12, 1), // previous show
      song(91, 11, 1),
      song(90, 10, 1),
    ];
    entries.sort(compareEntriesNewestFirst);
    expect(entries.map((e) => e.id)).toEqual([102, 101, 100, 92, 91, 90]);
  });

  it("should place optimistic temp entries (negative ids) before real entries", () => {
    const entries = [song(50, 10, 1), song(-1719148800000, 11, 1)];
    entries.sort(compareEntriesNewestFirst);
    expect(entries[0].id).toBe(-1719148800000);
    expect(entries[1].id).toBe(50);
  });

  it("should sort multiple temp entries with more-negative first (more recent)", () => {
    const older = song(-1000000, 11, 1);
    const newer = song(-2000000, 12, 1); // more negative = created later
    const entries = [older, newer];
    entries.sort(compareEntriesNewestFirst);
    expect(entries[0].id).toBe(-2000000);
    expect(entries[1].id).toBe(-1000000);
  });

  it("should return 0 for entries with the same id", () => {
    expect(compareEntriesNewestFirst(song(5, 1, 1), song(5, 1, 1))).toBe(0);
  });
});

describe("infinite-cache", () => {
  it("maxPlayOrder and primaryShowId read pages", () => {
    const draft = {
      pages: [
        [song(1, 10, 5), song(2, 5, 5)],
        [song(3, 3, 5)],
      ],
      pageParams: [0, 1],
    };
    expect(maxPlayOrder(draft)).toBe(10);
    expect(primaryShowId(draft)).toBe(5);
  });

  it("insertEntrySortedFirstPage keeps descending id on page 0", () => {
    const draft = {
      pages: [[song(10, 20, 1), song(8, 10, 1)]],
      pageParams: [0],
    };
    insertEntrySortedFirstPage(draft, song(9, 15, 1));
    expect(draft.pages[0].map((e) => e.id)).toEqual([10, 9, 8]);
  });

  it("insertEntrySortedFirstPage positions optimistic entry (negative id) at top", () => {
    const draft = {
      pages: [[song(50, 10, 1), song(49, 9, 1)]],
      pageParams: [0],
    };
    insertEntrySortedFirstPage(draft, song(-1719148800000, 11, 1));
    expect(draft.pages[0][0].id).toBe(-1719148800000);
    expect(draft.pages[0].map((e) => e.id)).toEqual([-1719148800000, 50, 49]);
  });

  it("insertEntrySortedFirstPage handles cross-show entries correctly", () => {
    // Page 0 has entries from two shows: current (ids 100-102, play_orders 1-3)
    // and previous (ids 90-92, play_orders 10-12).
    // A new entry (id 103) should go to the top regardless of play_order.
    const draft = {
      pages: [[song(102, 3, 2), song(101, 2, 2), song(92, 12, 1), song(91, 11, 1)]],
      pageParams: [0],
    };
    insertEntrySortedFirstPage(draft, song(103, 4, 2));
    expect(draft.pages[0].map((e) => e.id)).toEqual([103, 102, 101, 92, 91]);
  });

  it("insertEntrySortedFirstPage initializes empty cache", () => {
    const draft = { pages: [] as FlowsheetSongEntry[][], pageParams: [] as number[] };
    insertEntrySortedFirstPage(draft, song(1, 1, 2));
    expect(draft.pages).toEqual([[song(1, 1, 2)]]);
    expect(draft.pageParams).toEqual([0]);
  });

  it("removeEntryById removes from nested page", () => {
    const draft = {
      pages: [[song(1, 10, 1)], [song(2, 5, 1)]],
      pageParams: [0, 1],
    };
    removeEntryById(draft, 2);
    expect(draft.pages[1]).toHaveLength(0);
  });

  it("replaceEntryIdAllPages maintains id-descending sort after replacement", () => {
    // Temp entry at the top (optimistic entries sort first by compareEntriesNewestFirst)
    const draft = {
      pages: [[song(-1719148800000, 11, 1), song(50, 10, 1), song(49, 9, 1)]],
      pageParams: [0],
    };
    const server = song(51, 11, 1);
    replaceEntryIdAllPages(draft, -1719148800000, server);
    expect(draft.pages[0].map((e) => e.id)).toEqual([51, 50, 49]);
  });

  it("replaceEntryIdAllPages inserts when temp entry is not found", () => {
    const draft = {
      pages: [[song(50, 10, 1), song(49, 9, 1)]],
      pageParams: [0],
    };
    const server = song(51, 11, 1);
    replaceEntryIdAllPages(draft, -999, server);
    expect(draft.pages[0].map((e) => e.id)).toEqual([51, 50, 49]);
  });

  it("swapPlayOrdersForSwitch swaps play_order between two entries", () => {
    const a = song(1, 100, 1);
    const b = song(2, 50, 1);
    const draft = { pages: [[a, b]], pageParams: [0] };
    swapPlayOrdersForSwitch(draft, 1, 50);
    expect(draft.pages[0][0].play_order).toBe(50);
    expect(draft.pages[0][1].play_order).toBe(100);
  });

  it("buildOptimisticEntry builds a track row from manual submission", () => {
    const draft = { pages: [[song(1, 10, 7)]], pageParams: [0] };
    const { entry, tempId } = buildOptimisticEntry(
      {
        track_title: "X",
        artist_name: "Y",
        album_title: "Z",
        request_flag: false,
      },
      draft
    );
    expect(tempId).toBeLessThan(0);
    expect(entry.play_order).toBe(11);
    expect("track_title" in entry && entry.track_title).toBe("X");
  });
});
