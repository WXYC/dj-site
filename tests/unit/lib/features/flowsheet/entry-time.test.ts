import { describe, it, expect, afterEach, vi } from "vitest";
import { rangeEntryTime } from "@/lib/features/flowsheet/entry-time";

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
    // EST at this date) and 5:01 AM the next day in Asia/Tokyo -- a formatter
    // that fell back to the process's local zone instead of the explicit
    // station zone would print a different hour here.
    vi.stubEnv("TZ", "Asia/Tokyo");
    // process.env.TZ has a setter trap in Node's main process that resets
    // its cached Intl/Date local-zone derivation whenever the property is
    // assigned, so vi.stubEnv's assignment here takes effect immediately
    // (vitest's `forks` pool runs each test file in its own forked process,
    // which keeps that trap). A worker thread's process.env is a plain copy
    // without the trap, so the same assignment is silently inert there, and
    // the case below would pass vacuously on its original (station) zone
    // regardless of the bug this test exists to catch -- hence the guard
    // below, and why this file must run under vitest's default `forks`
    // pool, never `--pool=threads`.
    expect(
      new Intl.DateTimeFormat().resolvedOptions().timeZone,
      "TZ stub did not take effect in this process -- rerun this file under vitest's default `forks` pool, not `--pool=threads`"
    ).toBe("Asia/Tokyo");
    expect(
      rangeEntryTime({ entry_type: "track", add_time: "2026-01-15T20:01:00Z" })
    ).toBe("3:01 PM");
  });
});
