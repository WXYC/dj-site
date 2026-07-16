import { describe, it, expect, vi } from "vitest";
import type {
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";

const safeCaptureMock = vi.fn();
vi.mock("@/lib/posthog", () => ({
  safeCapture: (...args: unknown[]) => safeCaptureMock(...args),
}));
import {
  buildOptimisticEntry,
  compareEntriesNewestFirst,
  insertEntrySortedFirstPage,
  maxPlayOrder,
  movePlayOrder,
  nextOptimisticTempId,
  primaryShowId,
  removeEntryById,
  replaceEntryIdAllPages,
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

  it("replaceEntryIdAllPages inserts when temp entry is not found, capturing the #860 telemetry event", () => {
    safeCaptureMock.mockClear();
    const draft = {
      pages: [[song(50, 10, 1), song(49, 9, 1)]],
      pageParams: [0],
    };
    const server = song(51, 11, 1);
    replaceEntryIdAllPages(draft, -999, server);
    expect(draft.pages[0].map((e) => e.id)).toEqual([51, 50, 49]);
    expect(safeCaptureMock).toHaveBeenCalledWith(
      "flowsheet_optimistic_replace_miss",
      { tempId: -999, serverEntryId: 51 }
    );
  });

  it("replaceEntryIdAllPages does not emit telemetry on a normal swap", () => {
    safeCaptureMock.mockClear();
    const temp = song(-5, 11, 1);
    const draft = {
      pages: [[temp, song(50, 10, 1)]],
      pageParams: [0],
    };
    replaceEntryIdAllPages(draft, -5, song(51, 11, 1));
    expect(safeCaptureMock).not.toHaveBeenCalled();
  });

  it("primaryShowId skips orphaned entries so one null-show row can't read as 'nobody live' (#629)", () => {
    const orphan = song(90, 12, -1);
    const draft = { pages: [[orphan, song(89, 11, 5)], [song(88, 10, 5)]], pageParams: [0, 1] };
    expect(primaryShowId(draft)).toBe(5);
  });

  it("primaryShowId returns a negative optimistic show-marker id (only -1 is the orphan sentinel)", () => {
    // The #619 goLive fix pushes a show-start marker whose show_id is a fresh
    // negative tempId; it must win over the prior show's entries.
    const marker = song(-40, 13, -40);
    const draft = { pages: [[marker, song(89, 12, 5)]], pageParams: [0] };
    expect(primaryShowId(draft)).toBe(-40);
  });

  it("movePlayOrder refuses to renumber orphaned (show_id -1) entries as one block", () => {
    const draft = {
      pages: [[song(9, 3, -1), song(8, 2, -1), song(7, 1, -1)]],
      pageParams: [0],
    };
    movePlayOrder(draft, 9, 1);
    expect(draft.pages[0].map((e) => e.play_order)).toEqual([3, 2, 1]);
  });

  it("nextOptimisticTempId never collides across rapid same-millisecond calls (#620)", () => {
    const ids = new Set<number>();
    for (let i = 0; i < 1000; i++) ids.add(nextOptimisticTempId());
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toBeLessThan(0);
  });

  it("later temp ids sort newer under compareEntriesNewestFirst (#620)", () => {
    const older = nextOptimisticTempId();
    const newer = nextOptimisticTempId();
    expect(compareEntriesNewestFirst(song(newer, 2, 1), song(older, 1, 1))).toBeLessThan(0);
  });

  it("removeEntryById removes a duplicated id from every page (#643)", () => {
    const dupA = song(7, 5, 1);
    const dupB = song(7, 5, 1);
    const draft = {
      pages: [[song(9, 9, 1), dupA], [dupB, song(3, 3, 1)]],
      pageParams: [0, 1],
    };
    removeEntryById(draft, 7);
    expect(draft.pages[0].map((e) => e.id)).toEqual([9]);
    expect(draft.pages[1].map((e) => e.id)).toEqual([3]);
  });

  it("movePlayOrder moving down renumbers the crossed block up by one", () => {
    // Entry 5 (play_order 5) drops to position 2: server bumps 2,3,4 → 3,4,5.
    const draft = {
      pages: [[song(5, 5, 1), song(4, 4, 1), song(3, 3, 1), song(2, 2, 1), song(1, 1, 1)]],
      pageParams: [0],
    };
    movePlayOrder(draft, 5, 2);
    const byId = new Map(draft.pages[0].map((e) => [e.id, e.play_order]));
    expect(byId.get(5)).toBe(2);
    expect(byId.get(4)).toBe(5);
    expect(byId.get(3)).toBe(4);
    expect(byId.get(2)).toBe(3);
    expect(byId.get(1)).toBe(1);
  });

  it("movePlayOrder moving up renumbers the crossed block down by one", () => {
    // Entry 2 (play_order 2) rises to position 4: server drops 3,4 → 2,3.
    const draft = {
      pages: [[song(5, 5, 1), song(4, 4, 1), song(3, 3, 1), song(2, 2, 1), song(1, 1, 1)]],
      pageParams: [0],
    };
    movePlayOrder(draft, 2, 4);
    const byId = new Map(draft.pages[0].map((e) => [e.id, e.play_order]));
    expect(byId.get(2)).toBe(4);
    expect(byId.get(4)).toBe(3);
    expect(byId.get(3)).toBe(2);
    expect(byId.get(5)).toBe(5);
    expect(byId.get(1)).toBe(1);
  });

  it("movePlayOrder is a no-op when the position is unchanged", () => {
    const draft = {
      pages: [[song(2, 2, 1), song(1, 1, 1)]],
      pageParams: [0],
    };
    movePlayOrder(draft, 2, 2);
    expect(draft.pages[0].map((e) => e.play_order)).toEqual([2, 1]);
  });

  it("movePlayOrder is a no-op when the entry is missing", () => {
    const draft = {
      pages: [[song(2, 2, 1), song(1, 1, 1)]],
      pageParams: [0],
    };
    movePlayOrder(draft, 999, 1);
    expect(draft.pages[0].map((e) => e.play_order)).toEqual([2, 1]);
  });

  it("movePlayOrder never touches entries from other shows with overlapping play_orders", () => {
    // play_order is per-show; show 1's renumber must not disturb show 2's
    // rows even though their play_order ranges collide, and pages can span
    // shows.
    const draft = {
      pages: [
        [song(103, 3, 2), song(102, 2, 2), song(101, 1, 2)],
        [song(13, 3, 1), song(12, 2, 1), song(11, 1, 1)],
      ],
      pageParams: [0, 1],
    };
    movePlayOrder(draft, 103, 1);
    const show1 = draft.pages[1].map((e) => e.play_order);
    expect(show1).toEqual([3, 2, 1]);
    const byId = new Map(draft.pages[0].map((e) => [e.id, e.play_order]));
    expect(byId.get(103)).toBe(1);
    expect(byId.get(102)).toBe(3);
    expect(byId.get(101)).toBe(2);
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

  it("buildOptimisticEntry carries `segue` through the freeform (no album_id) branch", () => {
    const draft = { pages: [[song(1, 10, 7)]], pageParams: [0] };
    const { entry } = buildOptimisticEntry(
      {
        track_title: "la paradoja",
        artist_name: "Juana Molina",
        album_title: "DOGA",
        request_flag: false,
        segue: true,
      },
      draft
    );
    expect("segue" in entry && entry.segue).toBe(true);
  });

  it("buildOptimisticEntry carries `segue` through the album_id (rotation/catalog) branch", () => {
    const draft = { pages: [[song(1, 10, 7)]], pageParams: [0] };
    const { entry } = buildOptimisticEntry(
      {
        album_id: 42,
        track_title: "la paradoja",
        request_flag: false,
        segue: true,
      },
      draft
    );
    expect("segue" in entry && entry.segue).toBe(true);
  });

  it("buildOptimisticEntry takes the freeform branch when album_id key is present but undefined (#607)", () => {
    // usePlayNow's pre-gate payloads carried `album_id: undefined` for
    // freeform queue entries; key-presence alone must not select the blank
    // catalog branch.
    const draft = { pages: [[song(1, 10, 7)]], pageParams: [0] };
    const { entry } = buildOptimisticEntry(
      {
        track_title: "On Your Own Love Again",
        artist_name: "Jessica Pratt",
        album_title: "On Your Own Love Again",
        request_flag: false,
        album_id: undefined,
      } as FlowsheetSubmissionParams,
      draft
    );
    expect("artist_name" in entry && entry.artist_name).toBe("Jessica Pratt");
  });

  it("buildOptimisticEntry takes the freeform branch for synthesized negative album_id (#607)", () => {
    const draft = { pages: [[song(1, 10, 7)]], pageParams: [0] };
    const { entry } = buildOptimisticEntry(
      {
        track_title: "la paradoja",
        artist_name: "Juana Molina",
        album_title: "DOGA",
        request_flag: false,
        album_id: -42,
      } as FlowsheetSubmissionParams,
      draft
    );
    expect("artist_name" in entry && entry.artist_name).toBe("Juana Molina");
  });

  it("buildOptimisticEntry uses the -1 no-show sentinel on an empty cache (#629)", () => {
    const draft = { pages: [], pageParams: [] };
    const { entry } = buildOptimisticEntry(
      { track_title: "X", artist_name: "Y", album_title: "Z", request_flag: false },
      draft
    );
    expect(entry.show_id).toBe(-1);
  });

  it("buildOptimisticEntry leaves `segue` undefined when not provided", () => {
    const draft = { pages: [[song(1, 10, 7)]], pageParams: [0] };
    const { entry: freeform } = buildOptimisticEntry(
      {
        track_title: "X",
        artist_name: "Y",
        album_title: "Z",
        request_flag: false,
      },
      draft
    );
    expect("segue" in freeform && freeform.segue).toBeUndefined();

    const { entry: catalog } = buildOptimisticEntry(
      { album_id: 1, track_title: "X", request_flag: false },
      draft
    );
    expect("segue" in catalog && catalog.segue).toBeUndefined();
  });
});
