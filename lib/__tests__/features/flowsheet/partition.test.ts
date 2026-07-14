import { describe, it, expect } from "vitest";
import {
  compareCurrentShowOrder,
  partitionFlowsheetEntries,
} from "@/lib/features/flowsheet/partition";
import type {
  FlowsheetEntry,
  FlowsheetSongEntry,
  FlowsheetShowBlockEntry,
} from "@/lib/features/flowsheet/types";
import { TEST_ENTITY_IDS } from "@/lib/test-utils";

const CURRENT_SHOW = TEST_ENTITY_IDS.SHOW.CURRENT_SHOW;
const PAST_SHOW = TEST_ENTITY_IDS.SHOW.PAST_SHOW;

function song(id: number, show_id: number): FlowsheetSongEntry {
  return {
    id,
    play_order: id,
    show_id,
    track_title: `Track ${id}`,
    artist_name: "Autechre",
    album_title: "Confield",
    record_label: "Warp",
    request_flag: false,
  };
}

function showMarker(
  id: number,
  show_id: number,
  isStart: boolean
): FlowsheetShowBlockEntry {
  return {
    id,
    play_order: id,
    show_id,
    dj_name: "Test DJ",
    isStart,
    day: "4/20/2026",
    time: "2:00:00 PM",
  };
}

describe("partitionFlowsheetEntries", () => {
  it("returns everything in previous when not live", () => {
    const entries: FlowsheetEntry[] = [
      song(103, CURRENT_SHOW),
      song(102, CURRENT_SHOW),
      showMarker(101, CURRENT_SHOW, true),
    ];

    const result = partitionFlowsheetEntries(entries, CURRENT_SHOW, false);

    expect(result.current).toEqual([]);
    expect(result.previous).toEqual(entries);
  });

  it("returns everything in previous when currentShow is -1", () => {
    const entries: FlowsheetEntry[] = [song(100, CURRENT_SHOW)];

    const result = partitionFlowsheetEntries(entries, -1, true);

    expect(result.current).toEqual([]);
    expect(result.previous).toEqual(entries);
  });

  it("partitions entries by show_id when live", () => {
    const entries: FlowsheetEntry[] = [
      song(105, CURRENT_SHOW),
      song(104, CURRENT_SHOW),
      showMarker(103, CURRENT_SHOW, true),
      song(102, PAST_SHOW),
      showMarker(101, PAST_SHOW, true),
    ];

    const result = partitionFlowsheetEntries(entries, CURRENT_SHOW, true);

    expect(result.current.map((e) => e.id)).toEqual([105, 104, 103]);
    expect(result.previous.map((e) => e.id)).toEqual([102, 101]);
  });

  it("includes start and end markers in current show entries", () => {
    const entries: FlowsheetEntry[] = [
      showMarker(107, CURRENT_SHOW, false), // end marker
      song(106, CURRENT_SHOW),
      song(105, CURRENT_SHOW),
      showMarker(104, CURRENT_SHOW, true), // start marker
    ];

    const result = partitionFlowsheetEntries(entries, CURRENT_SHOW, true);

    expect(result.current).toHaveLength(4);
    expect(result.current.map((e) => e.id)).toEqual([107, 106, 105, 104]);
    expect(result.previous).toEqual([]);
  });

  it("preserves chronological order across show boundaries", () => {
    // Simulates: DJ A plays show, ends, DJ B starts new show, ends.
    // play_orders are strictly increasing over time. Entries sorted play_order DESC.
    const entries: FlowsheetEntry[] = [
      showMarker(110, CURRENT_SHOW, false), // B ended the set
      song(109, CURRENT_SHOW),              // B played a track
      song(108, CURRENT_SHOW),              // B played a track
      showMarker(107, CURRENT_SHOW, true),  // B started the set
      showMarker(106, PAST_SHOW, false),    // A ended the set
      song(105, PAST_SHOW),                 // A played a track
      song(104, PAST_SHOW),                 // A played a track
      showMarker(103, PAST_SHOW, true),     // A started the set
    ];

    const result = partitionFlowsheetEntries(entries, CURRENT_SHOW, true);

    // Current show has all B entries (including markers)
    expect(result.current.map((e) => e.id)).toEqual([110, 109, 108, 107]);
    // Previous show has all A entries
    expect(result.previous.map((e) => e.id)).toEqual([106, 105, 104, 103]);

    // Concatenation preserves strict play_order DESC order
    const concatenated = [...result.current, ...result.previous];
    for (let i = 0; i < concatenated.length - 1; i++) {
      expect(concatenated[i].play_order).toBeGreaterThan(concatenated[i + 1].play_order);
    }
  });

  it("returns empty partitions for empty input", () => {
    const result = partitionFlowsheetEntries([], CURRENT_SHOW, true);

    expect(result.current).toEqual([]);
    expect(result.previous).toEqual([]);
  });

  it("puts all entries in current when only one show exists", () => {
    const entries: FlowsheetEntry[] = [
      song(103, CURRENT_SHOW),
      song(102, CURRENT_SHOW),
      showMarker(101, CURRENT_SHOW, true),
    ];

    const result = partitionFlowsheetEntries(entries, CURRENT_SHOW, true);

    expect(result.current).toEqual(entries);
    expect(result.previous).toEqual([]);
  });

  it("sorts current by play_order when a reorder made it diverge from id order", () => {
    // A persisted drag reorder rewrites play_orders but never ids, so the
    // id-DESC input order no longer matches the intended display order.
    // Entry 105 was dragged below 103: play_orders are now 105→2, 104→4, 103→3.
    const reordered = (id: number, play_order: number): FlowsheetSongEntry => ({
      ...song(id, CURRENT_SHOW),
      play_order,
    });
    const entries: FlowsheetEntry[] = [
      reordered(105, 2),
      reordered(104, 4),
      reordered(103, 3),
      { ...showMarker(101, CURRENT_SHOW, true), play_order: 1 },
      song(90, PAST_SHOW),
    ];

    const result = partitionFlowsheetEntries(entries, CURRENT_SHOW, true);

    expect(result.current.map((e) => e.id)).toEqual([104, 103, 105, 101]);
    // Previous shows keep their incoming (id DESC) order untouched.
    expect(result.previous.map((e) => e.id)).toEqual([90]);
  });

  it("breaks play_order collisions in current by id descending", () => {
    // tubafrenzy's webhook and dj-site can assign the same play_order within
    // a show; the newer row (higher id) must consistently render first.
    const collided = (id: number): FlowsheetSongEntry => ({
      ...song(id, CURRENT_SHOW),
      play_order: 7,
    });
    const entries: FlowsheetEntry[] = [collided(105), collided(104)];

    const result = partitionFlowsheetEntries(entries, CURRENT_SHOW, true);

    expect(result.current.map((e) => e.id)).toEqual([105, 104]);
  });
});

describe("compareCurrentShowOrder", () => {
  it("orders by play_order descending", () => {
    const a = { ...song(1, CURRENT_SHOW), play_order: 5 };
    const b = { ...song(2, CURRENT_SHOW), play_order: 3 };
    expect(compareCurrentShowOrder(a, b)).toBeLessThan(0);
    expect(compareCurrentShowOrder(b, a)).toBeGreaterThan(0);
  });

  it("falls back to id descending on equal play_order", () => {
    const older = { ...song(1, CURRENT_SHOW), play_order: 5 };
    const newer = { ...song(2, CURRENT_SHOW), play_order: 5 };
    expect(compareCurrentShowOrder(newer, older)).toBeLessThan(0);
  });
});
