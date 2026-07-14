import { describe, it, expect } from "vitest";
import { movePlayOrder } from "@/lib/features/flowsheet/infinite-cache";
import {
  compareCurrentShowOrder,
  partitionFlowsheetEntries,
} from "@/lib/features/flowsheet/partition";
import {
  computeDragTarget,
  moveAdjacent,
} from "@/lib/features/flowsheet/reorder";
import type {
  FlowsheetEntry,
  FlowsheetMessageEntry,
  FlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import { TEST_ENTITY_IDS } from "@/lib/test-utils";

const SHOW = TEST_ENTITY_IDS.SHOW.CURRENT_SHOW;

function song(id: number, play_order: number): FlowsheetSongEntry {
  return {
    id,
    play_order,
    show_id: SHOW,
    track_title: `Track ${id}`,
    artist_name: "Stereolab",
    album_title: "DOGA",
    record_label: "Warp",
    request_flag: false,
  };
}

function talkset(id: number, play_order: number): FlowsheetMessageEntry {
  return {
    id,
    play_order,
    show_id: SHOW,
    message: "Talkset",
  };
}

/** Move the entry at `from` to `to` in a copy of the array (drag simulation). */
function moved(
  entries: FlowsheetEntry[],
  from: number,
  to: number
): FlowsheetEntry[] {
  const next = [...entries];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
  return next;
}

// Display order: play_order DESC (newest first), like the live flowsheet.
const snapshot: FlowsheetEntry[] = [
  song(105, 5),
  song(104, 4),
  talkset(103, 3),
  song(102, 2),
  song(101, 1),
];

describe("computeDragTarget", () => {
  it("targets the displaced entry's play_order when dragging down", () => {
    // 105 dropped two slots down (distance > 1, across the talkset).
    const finalOrder = moved(snapshot, 0, 2);
    expect(computeDragTarget(snapshot, finalOrder, 105)).toBe(3);
  });

  it("targets the displaced entry's play_order when dragging up", () => {
    // 101 dragged from the bottom to the second slot.
    const finalOrder = moved(snapshot, 4, 1);
    expect(computeDragTarget(snapshot, finalOrder, 101)).toBe(4);
  });

  it("counts non-draggable marker rows in the index math", () => {
    // 102 dragged up one slot lands where the talkset sat.
    const finalOrder = moved(snapshot, 3, 2);
    expect(computeDragTarget(snapshot, finalOrder, 102)).toBe(3);
  });

  it("returns null when the entry did not move", () => {
    expect(computeDragTarget(snapshot, snapshot, 104)).toBeNull();
  });

  it("returns null when the entry is missing from either order", () => {
    expect(computeDragTarget(snapshot, snapshot, 999)).toBeNull();
    expect(
      computeDragTarget(snapshot, snapshot.slice(1), snapshot[0].id)
    ).toBeNull();
  });

  it("round-trips through the optimistic cache patch to the dropped order", () => {
    // Parity check across the whole client pipeline: the computed target,
    // applied via movePlayOrder (which mirrors the server's renumber) and
    // re-sorted the way the flowsheet displays entries, must reproduce
    // exactly the order the DJ dropped.
    const drags: Array<[number, number]> = [
      [0, 3], // top entry dragged deep down
      [4, 0], // bottom entry dragged to now-playing
      [1, 2], // adjacent hop across the talkset
    ];

    for (const [from, to] of drags) {
      const finalOrder = moved(snapshot, from, to);
      const entry = snapshot[from];
      const target = computeDragTarget(snapshot, finalOrder, entry.id);
      expect(target).not.toBeNull();

      const draft = {
        pages: [snapshot.map((e) => ({ ...e }))],
        pageParams: [0],
      };
      movePlayOrder(draft, entry.id, target!);
      const { current } = partitionFlowsheetEntries(
        [...draft.pages[0]].sort(compareCurrentShowOrder),
        SHOW,
        true
      );
      expect(current.map((e) => e.id)).toEqual(finalOrder.map((e) => e.id));
    }
  });
});

describe("moveAdjacent", () => {
  it("swaps with the previous entry when moving up", () => {
    const next = moveAdjacent(snapshot, 104, "up");
    expect(next?.map((e) => e.id)).toEqual([104, 105, 103, 102, 101]);
  });

  it("swaps with the next entry when moving down", () => {
    const next = moveAdjacent(snapshot, 104, "down");
    expect(next?.map((e) => e.id)).toEqual([105, 103, 104, 102, 101]);
  });

  it("returns null at the edges", () => {
    expect(moveAdjacent(snapshot, 105, "up")).toBeNull();
    expect(moveAdjacent(snapshot, 101, "down")).toBeNull();
  });

  it("returns null for an unknown entry", () => {
    expect(moveAdjacent(snapshot, 999, "up")).toBeNull();
  });

  it("does not mutate the input", () => {
    const before = snapshot.map((e) => e.id);
    moveAdjacent(snapshot, 104, "down");
    expect(snapshot.map((e) => e.id)).toEqual(before);
  });

  it("one-step move computes the same target as the equivalent drag", () => {
    // The mobile buttons reuse the drag position math; a move down is a drag
    // whose final order is the adjacent swap.
    const next = moveAdjacent(snapshot, 104, "down");
    expect(computeDragTarget(snapshot, next!, 104)).toBe(3);
  });
});
