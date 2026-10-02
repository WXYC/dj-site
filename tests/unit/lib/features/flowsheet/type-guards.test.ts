import { describe, expect, it } from "vitest";

import {
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetTalksetEntry,
  isFlowsheetBreakpointEntry,
  FlowsheetEntry,
} from "@/lib/features/flowsheet/types";

const base = { id: 1, play_order: 1, show_id: 1 };

const songEntry: FlowsheetEntry = {
  ...base,
  entry_type: "track",
  track_title: "VI Scose Poise",
  artist_name: "Autechre",
  album_title: "Confield",
  record_label: "Warp",
  request_flag: false,
};

const startShowEntry: FlowsheetEntry = {
  ...base,
  entry_type: "show_start",
  dj_name: "DJ Bluejay",
  isStart: true,
  day: "4/4/2026",
  time: "8:00:00 PM",
};

const endShowEntry: FlowsheetEntry = {
  ...base,
  entry_type: "show_end",
  dj_name: "DJ Bluejay",
  isStart: false,
  day: "4/4/2026",
  time: "10:00:00 PM",
};

const talksetEntry: FlowsheetEntry = {
  ...base,
  entry_type: "talkset",
  message: "------ Talkset -------",
};

const breakpointEntry: FlowsheetEntry = {
  ...base,
  entry_type: "breakpoint",
  message: "--- 9:00 PM Breakpoint ---",
  day: "4/4/2026",
  time: "9:00:00 PM",
};

describe("isFlowsheetTalksetEntry / isFlowsheetBreakpointEntry classify by entry_type, not message text", () => {
  it.each([
    {
      name: "a message row whose text says Breakpoint",
      entry: { ...base, entry_type: "message", message: "Breakpoint" } satisfies FlowsheetEntry,
      isTalkset: false,
      isBreakpoint: false,
    },
    {
      name: "a talkset whose text says Breakpoint",
      entry: { ...base, entry_type: "talkset", message: "Breakpoint" } satisfies FlowsheetEntry,
      isTalkset: true,
      isBreakpoint: false,
    },
    {
      name: "a breakpoint whose text says Talkset",
      entry: { ...base, entry_type: "breakpoint", message: "Talkset" } satisfies FlowsheetEntry,
      isTalkset: false,
      isBreakpoint: true,
    },
    {
      name: "a message whose text says Talkset",
      entry: { ...base, entry_type: "message", message: "Talkset" } satisfies FlowsheetEntry,
      isTalkset: false,
      isBreakpoint: false,
    },
    {
      name: "a breakpoint whose text says neither",
      entry: { ...base, entry_type: "breakpoint", message: "3:00 PM" } satisfies FlowsheetEntry,
      isTalkset: false,
      isBreakpoint: true,
    },
    {
      name: "a talkset whose text says neither",
      entry: { ...base, entry_type: "talkset", message: "" } satisfies FlowsheetEntry,
      isTalkset: true,
      isBreakpoint: false,
    },
    { name: "a talkset", entry: talksetEntry, isTalkset: true, isBreakpoint: false },
    { name: "a breakpoint", entry: breakpointEntry, isTalkset: false, isBreakpoint: true },
    { name: "a song", entry: songEntry, isTalkset: false, isBreakpoint: false },
    { name: "a show start", entry: startShowEntry, isTalkset: false, isBreakpoint: false },
  ])("$name", ({ entry, isTalkset, isBreakpoint }) => {
    expect(isFlowsheetTalksetEntry(entry)).toBe(isTalkset);
    expect(isFlowsheetBreakpointEntry(entry)).toBe(isBreakpoint);
  });
});

describe("flowsheet type guards", () => {
  describe("isFlowsheetSongEntry", () => {
    it("returns true for song entries", () => {
      expect(isFlowsheetSongEntry(songEntry)).toBe(true);
    });

    it("returns false for show entries", () => {
      expect(isFlowsheetSongEntry(startShowEntry)).toBe(false);
    });

    it("returns false for message entries", () => {
      expect(isFlowsheetSongEntry(talksetEntry)).toBe(false);
    });
  });

  describe("isFlowsheetStartShowEntry", () => {
    it("returns true for show start", () => {
      expect(isFlowsheetStartShowEntry(startShowEntry)).toBe(true);
    });

    it("returns false for show end", () => {
      expect(isFlowsheetStartShowEntry(endShowEntry)).toBe(false);
    });

    it("returns false for songs", () => {
      expect(isFlowsheetStartShowEntry(songEntry)).toBe(false);
    });
  });

  describe("isFlowsheetEndShowEntry", () => {
    it("returns true for show end", () => {
      expect(isFlowsheetEndShowEntry(endShowEntry)).toBe(true);
    });

    it("returns false for show start", () => {
      expect(isFlowsheetEndShowEntry(startShowEntry)).toBe(false);
    });
  });
});
