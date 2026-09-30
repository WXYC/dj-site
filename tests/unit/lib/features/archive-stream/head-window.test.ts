import { describe, it, expect } from "vitest";
import type { FlowsheetV2Entry } from "@wxyc/shared";
import {
  computeHeadWindow,
  reverseWireOrder,
  MIN_WINDOW_MS,
  CLOCK_SKEW_ALLOWANCE_MS,
  ARCHIVE_START_MS,
} from "@/lib/features/archive-stream/head-window";

function rangeEntry(id: number): FlowsheetV2Entry {
  return {
    id,
    play_order: id,
    show_id: 1,
    request_flag: false,
    entry_type: "track",
    add_time: new Date(0).toISOString(),
  };
}

describe("computeHeadWindow", () => {
  it("anchors the window on now, one MIN_WINDOW_MS wide, reaching CLOCK_SKEW_ALLOWANCE_MS past now", () => {
    const now = Date.parse("2026-09-26T16:00:00.000Z");

    expect(computeHeadWindow(now)).toEqual({
      start: now - MIN_WINDOW_MS,
      requestEnd: now + CLOCK_SKEW_ALLOWANCE_MS,
    });
  });

  it("clamps the window's start to ARCHIVE_START_MS near the archive's floor", () => {
    const now = ARCHIVE_START_MS + 60_000;

    expect(computeHeadWindow(now).start).toBe(ARCHIVE_START_MS);
  });
});

describe("reverseWireOrder", () => {
  it("reverses a window's oldest-first wire order", () => {
    const entries = [rangeEntry(1), rangeEntry(2), rangeEntry(3)];

    expect(reverseWireOrder(entries).map((e) => e.id)).toEqual([3, 2, 1]);
  });

  it("does not mutate its input", () => {
    const entries = [rangeEntry(1), rangeEntry(2)];

    reverseWireOrder(entries);

    expect(entries.map((e) => e.id)).toEqual([1, 2]);
  });
});
