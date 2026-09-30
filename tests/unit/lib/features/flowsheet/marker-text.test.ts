import { describe, it, expect } from "vitest";
import {
  getMarkerText,
  messageEntryLabel,
} from "@/lib/features/flowsheet/marker-text";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";

const startShow = {
  dj_name: "DJ Chowder",
  isStart: true,
  day: "Monday",
  time: "3:00 PM",
} as unknown as FlowsheetEntry;

const endShow = {
  dj_name: "DJ Chowder",
  isStart: false,
  day: "Monday",
  time: "3:00 PM",
} as unknown as FlowsheetEntry;

const talkset = {
  message: "Talkset",
} as unknown as FlowsheetEntry;

const breakpoint = {
  message: "3:00 PM Breakpoint",
} as unknown as FlowsheetEntry;

const generic = {
  message: "Fund drive pitch",
} as unknown as FlowsheetEntry;

describe("getMarkerText", () => {
  it.each([
    ["show_start", startShow, "DJ Chowder", "started the set"],
    ["show_end", endShow, "DJ Chowder", "ended the set"],
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
