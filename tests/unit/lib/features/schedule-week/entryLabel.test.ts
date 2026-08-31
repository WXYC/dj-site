import { describe, it, expect } from "vitest";
import { describeNonTrackEntry } from "@/lib/features/schedule-week/entryLabel";
import type { FlowsheetRangeEntry } from "@wxyc/shared";

const entry = (over: Partial<FlowsheetRangeEntry>): FlowsheetRangeEntry =>
  ({
    id: 1,
    play_order: 1,
    show_id: 1951179,
    request_flag: false,
    add_time: "2026-08-27T19:02:03.000Z",
    ...over,
  }) as FlowsheetRangeEntry;

// The label is the flowsheet's own row copy, resolved through the one switch
// that also drives the live sheet's icons and tones. A second copy here is what
// let the two vocabularies drift apart in the first place.
describe("describeNonTrackEntry", () => {
  it.each([
    ["show_start", "DJ Chowder started the set"],
    ["dj_join", "DJ Chowder started the set"],
    ["show_end", "DJ Chowder ended the set"],
    ["dj_leave", "DJ Chowder ended the set"],
  ] as const)("names the %s marker by its DJ", (entry_type, expected) => {
    // These carry no message at all, so a `message ?? entry_type` fallback
    // prints the wire token.
    expect(
      describeNonTrackEntry(entry({ entry_type, dj_name: "DJ Chowder" }))
    ).toBe(expected);
  });

  it("normalizes the legacy talkset token", () => {
    expect(
      describeNonTrackEntry(entry({ entry_type: "talkset", message: "TALKSET" }))
    ).toBe("Talkset");
  });

  it("names a breakpoint by the hour it marks", () => {
    expect(
      describeNonTrackEntry(
        entry({
          entry_type: "breakpoint",
          message: "--- 3:00 PM BREAKPOINT ---",
          add_time: "2026-08-27T19:02:03.000Z",
          radio_hour: "2026-08-27T19:00:00.000Z",
        })
      )
    ).toBe("3:00 PM Breakpoint");
  });

  it("prints a generic message row's own text", () => {
    expect(
      describeNonTrackEntry(
        entry({ entry_type: "message", message: "Fund drive pitch" })
      )
    ).toBe("Fund drive pitch");
  });

  it("never prints a wire token", () => {
    expect(
      describeNonTrackEntry(entry({ entry_type: "show_start" }))
    ).not.toContain("show_start");
  });
});
