import { describe, it, expect } from "vitest";
import { timeOf } from "@/lib/features/flowsheet/entry-time";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import { isFlowsheetBreakpointEntry } from "@/lib/features/flowsheet/types";
import { createTestV2BreakpointEntry } from "@/tests/fixtures/fixtures";

// This suite runs under the process's default time zone, which is not
// America/New_York in this environment (nor CI's), so any accidental switch
// to a local-zone formatter fails these cases instead of passing by
// coincidence.

describe("timeOf", () => {
  it("shows the marked hour for a breakpoint with radio_hour", () => {
    expect(
      timeOf(
        { add_time: "2026-01-15T20:01:00Z", radio_hour: "2026-01-15T20:00:00Z" },
        true
      )
    ).toBe("3:00 PM");
  });

  it("falls back to add_time when a breakpoint's radio_hour is null", () => {
    expect(
      timeOf({ add_time: "2026-01-15T20:01:00Z", radio_hour: null }, true)
    ).toBe("3:01 PM");
  });

  it("falls back to add_time when a breakpoint's radio_hour is absent", () => {
    expect(timeOf({ add_time: "2026-01-15T20:01:00Z" }, true)).toBe("3:01 PM");
  });

  it.each([
    ["track", { add_time: "2026-01-15T20:01:00Z" }],
    ["talkset", { add_time: "2026-01-15T20:01:00Z" }],
    ["show-marker", { add_time: "2026-01-15T20:01:00Z" }],
  ] as const)("shows add_time for a non-breakpoint %s row", (_kind, entry) => {
    expect(timeOf(entry, false)).toBe("3:01 PM");
  });

  it("ignores radio_hour on a non-breakpoint row", () => {
    expect(
      timeOf(
        { add_time: "2026-01-15T20:01:00Z", radio_hour: "2026-01-15T20:00:00Z" },
        false
      )
    ).toBe("3:01 PM");
  });

  it("returns an empty string when add_time is missing", () => {
    expect(timeOf({}, false)).toBe("");
  });

  it("returns an empty string for a breakpoint with neither timestamp", () => {
    expect(timeOf({}, true)).toBe("");
  });

  it("accepts a converted live breakpoint without conversion to the wire shape", () => {
    const entry = convertV2Entry(
      createTestV2BreakpointEntry({
        add_time: "2026-01-15T20:01:00Z",
        radio_hour: "2026-01-15T20:00:00Z",
      })
    );
    expect(timeOf(entry, isFlowsheetBreakpointEntry(entry))).toBe("3:00 PM");
  });
});
