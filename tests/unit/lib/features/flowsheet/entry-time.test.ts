import { describe, it, expect, afterEach, vi } from "vitest";
import { rangeEntryTime, flowsheetEntryTime } from "@/lib/features/flowsheet/entry-time";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import { buildOptimisticEntry } from "@/lib/features/flowsheet/infinite-cache";
import {
  createTestV2BreakpointEntry,
  createTestV2TrackEntry,
  createTestV2TalksetEntry,
  createTestV2MessageEntry,
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
    // EST at this date) and 5:01 AM the next day in Asia/Tokyo -- a formatter
    // that fell back to the process's local zone instead of the explicit
    // station zone would print a different hour here.
    vi.stubEnv("TZ", "Asia/Tokyo");
    // vi.stubEnv only rewrites process.env.TZ in whichever thread runs this
    // file. A forked child process re-reads it (Node re-derives Intl/Date's
    // local zone from the environment at each call), so the stub takes effect
    // there; a worker thread keeps its own copy of process.env and never
    // re-triggers that derivation, so the stub silently does nothing and the
    // case below would pass on its original (station) zone regardless of the
    // bug this test exists to catch. This file must run under vitest's
    // default `forks` pool, never `--pool=threads`.
    expect(
      new Intl.DateTimeFormat().resolvedOptions().timeZone,
      "TZ stub did not take effect in this process -- rerun this file under vitest's default `forks` pool, not `--pool=threads`"
    ).toBe("Asia/Tokyo");
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

  it.each([
    ["talkset", createTestV2TalksetEntry],
    ["message", createTestV2MessageEntry],
  ] as const)(
    'shows add_time, not the marked hour, for a converted %s row whose own message mentions "Breakpoint"',
    (_kind, factory) => {
      // Neither arm attaches radio_hour -- only the wire breakpoint arm does
      // -- so a row that merely talks about a breakpoint must still read its
      // own add_time.
      const entry = convertV2Entry(
        factory({
          message: "3:00 PM Breakpoint",
          add_time: "2026-01-15T20:01:00Z",
        })
      );
      expect(flowsheetEntryTime(entry)).toBe("3:01 PM");
    }
  );

  // Conversion never produces this shape -- only breakpointDisplayFields
  // attaches radio_hour, and only from the wire breakpoint arm -- but
  // splicing one onto an ordinary converted track row isolates which signal
  // flowsheetEntryTime actually keys off. A version keyed on message text
  // (isFlowsheetBreakpointEntry) would read this row's plain track title,
  // find no "Breakpoint", and print add_time instead.
  it("renders a spliced-on radio_hour, not add_time, for an otherwise track-shaped row", () => {
    const entry = {
      ...convertV2Entry(
        createTestV2TrackEntry({ add_time: "2026-01-15T20:01:00Z" })
      ),
      radio_hour: "2026-01-15T20:00:00Z",
    };
    expect(flowsheetEntryTime(entry)).toBe("3:00 PM");
  });

  it("renders the empty string, without throwing, for an optimistic breakpoint row", () => {
    // buildOptimisticEntry's message branch (infinite-cache.ts) gives a
    // breakpoint row `message`/`day`/`time` up front but never `add_time` or
    // `radio_hour` -- both arrive only once the server's row replaces it.
    const { entry } = buildOptimisticEntry(
      { message: "11:00 PM Breakpoint" },
      { pages: [[]] }
    );
    expect(() => flowsheetEntryTime(entry)).not.toThrow();
    expect(flowsheetEntryTime(entry)).toBe("");
  });

  it("renders station time under a non-Eastern process zone", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    // See the identical guard in the rangeEntryTime case above: a
    // `--pool=threads` run keeps its own copy of process.env, the stub never
    // reaches Node's zone derivation, and this case would pass vacuously on
    // the station's own zone.
    expect(
      new Intl.DateTimeFormat().resolvedOptions().timeZone,
      "TZ stub did not take effect in this process -- rerun this file under vitest's default `forks` pool, not `--pool=threads`"
    ).toBe("Asia/Tokyo");
    const entry = convertV2Entry(
      createTestV2BreakpointEntry({
        add_time: "2026-01-15T20:01:00Z",
        radio_hour: "2026-01-15T20:00:00Z",
      })
    );
    expect(flowsheetEntryTime(entry)).toBe("3:00 PM");
  });
});
