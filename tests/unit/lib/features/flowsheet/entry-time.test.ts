import { describe, it, expect, afterEach, vi } from "vitest";
import { rangeEntryTime, flowsheetEntryTime } from "@/lib/features/flowsheet/entry-time";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import {
  createTestV2BreakpointEntry,
  createTestV2TrackEntry,
  createTestV2TalksetEntry,
  createTestV2ShowStartEntry,
} from "@/tests/fixtures/fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rangeEntryTime", () => {
  it("shows the marked hour for a breakpoint with radio_hour", () => {
    expect(
      rangeEntryTime({
        entry_type: "breakpoint",
        add_time: "2026-01-15T20:01:00Z",
        radio_hour: "2026-01-15T20:00:00Z",
      })
    ).toBe("3:00 PM");
  });

  it("falls back to add_time when a breakpoint's radio_hour is null", () => {
    expect(
      rangeEntryTime({
        entry_type: "breakpoint",
        add_time: "2026-01-15T20:01:00Z",
        radio_hour: null,
      })
    ).toBe("3:01 PM");
  });

  it("falls back to add_time when a breakpoint's radio_hour is absent", () => {
    expect(
      rangeEntryTime({ entry_type: "breakpoint", add_time: "2026-01-15T20:01:00Z" })
    ).toBe("3:01 PM");
  });

  it.each([
    ["track", "track"],
    ["talkset", "talkset"],
    ["show-marker", "show_start"],
  ] as const)(
    "shows add_time and ignores radio_hour for a non-breakpoint %s row",
    (_kind, entry_type) => {
      expect(
        rangeEntryTime({
          entry_type,
          add_time: "2026-01-15T20:01:00Z",
          // Would render 3:00 PM if the rule mistook this row for a
          // breakpoint -- only entry_type may select radio_hour.
          radio_hour: "2026-01-15T20:00:00Z",
        })
      ).toBe("3:01 PM");
    }
  );

  it("returns an empty string when add_time is missing", () => {
    expect(rangeEntryTime({ entry_type: "track" })).toBe("");
  });

  it("returns an empty string for a breakpoint with neither timestamp", () => {
    expect(rangeEntryTime({ entry_type: "breakpoint" })).toBe("");
  });

  it("renders station time under a non-Eastern process zone", () => {
    // 2026-01-15T20:01:00Z is 3:01 PM in the station's zone (America/New_York,
    // EST at this date) and 12:01 PM in Asia/Tokyo's calendar day ahead -- a
    // formatter that fell back to the process's local zone instead of the
    // explicit station zone would print a different hour here.
    vi.stubEnv("TZ", "Asia/Tokyo");
    expect(
      rangeEntryTime({ entry_type: "track", add_time: "2026-01-15T20:01:00Z" })
    ).toBe("3:01 PM");
  });
});

describe("flowsheetEntryTime", () => {
  it("shows the marked hour for a converted breakpoint with radio_hour", () => {
    const entry = convertV2Entry(
      createTestV2BreakpointEntry({
        add_time: "2026-01-15T20:01:00Z",
        radio_hour: "2026-01-15T20:00:00Z",
      })
    );
    expect(flowsheetEntryTime(entry)).toBe("3:00 PM");
  });

  it("falls back to add_time when a converted breakpoint's radio_hour is null", () => {
    const entry = convertV2Entry(
      createTestV2BreakpointEntry({
        add_time: "2026-01-15T20:01:00Z",
        radio_hour: null,
      })
    );
    expect(flowsheetEntryTime(entry)).toBe("3:01 PM");
  });

  it.each([
    ["track", createTestV2TrackEntry],
    ["talkset", createTestV2TalksetEntry],
    ["show-marker", createTestV2ShowStartEntry],
  ] as const)(
    "shows add_time for a converted non-breakpoint %s row",
    (_kind, factory) => {
      const entry = convertV2Entry(factory({ add_time: "2026-01-15T20:01:00Z" }));
      expect(flowsheetEntryTime(entry)).toBe("3:01 PM");
    }
  );

  it("renders station time under a non-Eastern process zone", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    const entry = convertV2Entry(
      createTestV2BreakpointEntry({
        add_time: "2026-01-15T20:01:00Z",
        radio_hour: "2026-01-15T20:00:00Z",
      })
    );
    expect(flowsheetEntryTime(entry)).toBe("3:00 PM");
  });
});
