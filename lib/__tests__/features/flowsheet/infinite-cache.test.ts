import { describe, it, expect } from "vitest";
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import {
  buildOptimisticEntry,
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

  it("insertEntrySortedFirstPage keeps descending play_order on page 0", () => {
    const draft = {
      pages: [[song(1, 10, 1), song(2, 8, 1)]],
      pageParams: [0],
    };
    insertEntrySortedFirstPage(draft, song(99, 12, 1));
    expect(draft.pages[0].map((e) => e.id)).toEqual([99, 1, 2]);
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

  it("replaceEntryIdAllPages swaps temp id for server entry", () => {
    const draft = {
      pages: [[song(-1, 10, 1)]],
      pageParams: [0],
    };
    const server = song(42, 10, 1);
    replaceEntryIdAllPages(draft, -1, server);
    expect(draft.pages[0][0].id).toBe(42);
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
