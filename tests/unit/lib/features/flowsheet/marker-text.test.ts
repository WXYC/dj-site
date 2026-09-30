import { describe, it, expect } from "vitest";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import {
  getMarkerText,
  messageEntryLabel,
} from "@/lib/features/flowsheet/marker-text";
import {
  createTestV2BreakpointEntry,
  createTestV2DJJoinEntry,
  createTestV2DJLeaveEntry,
  createTestV2MessageEntry,
  createTestV2ShowEndEntry,
  createTestV2ShowStartEntry,
  createTestV2TalksetEntry,
} from "@/tests/fixtures/fixtures";

// Built through convertV2Entry so each row has the shape the live sheet hands
// the switch: dj_join/dj_leave only read as set markers after conversion folds
// them into the show-marker shape.
const startShow = convertV2Entry(
  createTestV2ShowStartEntry({ dj_name: "DJ Chowder" })
);
const endShow = convertV2Entry(
  createTestV2ShowEndEntry({ dj_name: "DJ Chowder" })
);
const djJoin = convertV2Entry(
  createTestV2DJJoinEntry({ dj_name: "DJ Chowder" })
);
const djLeave = convertV2Entry(
  createTestV2DJLeaveEntry({ dj_name: "DJ Chowder" })
);
const talkset = convertV2Entry(createTestV2TalksetEntry({ message: "Talkset" }));
const breakpoint = convertV2Entry(
  createTestV2BreakpointEntry({
    message: "3:00 PM Breakpoint",
    radio_hour: null,
  })
);
const generic = convertV2Entry(
  createTestV2MessageEntry({ message: "Fund drive pitch" })
);

describe("getMarkerText", () => {
  it.each([
    ["show_start", startShow, "DJ Chowder", "started the set"],
    ["show_end", endShow, "DJ Chowder", "ended the set"],
    ["dj_join", djJoin, "DJ Chowder", "started the set"],
    ["dj_leave", djLeave, "DJ Chowder", "ended the set"],
    ["talkset", talkset, "Talkset", undefined],
    ["breakpoint", breakpoint, "3:00 PM Breakpoint", undefined],
    ["generic message", generic, "Fund drive pitch", undefined],
  ] as const)("%s", (_kind, entry, headline, caption) => {
    expect(getMarkerText(entry)).toEqual({ headline, caption });
  });
});

describe("messageEntryLabel", () => {
  it("joins headline and caption when present", () => {
    expect(messageEntryLabel(startShow)).toBe("DJ Chowder started the set");
  });

  it("returns the headline alone when there is no caption", () => {
    expect(messageEntryLabel(talkset)).toBe("Talkset");
  });
});
