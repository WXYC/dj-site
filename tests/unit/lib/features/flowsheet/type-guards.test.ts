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

const undefinedMessageEntry: FlowsheetEntry = {
  ...base,
  entry_type: "message",
  message: undefined as unknown as string,
};

const nullMessageEntry: FlowsheetEntry = {
  ...base,
  entry_type: "message",
  message: null as unknown as string,
};

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

  describe("isFlowsheetTalksetEntry", () => {
    it("returns true for talkset messages", () => {
      expect(isFlowsheetTalksetEntry(talksetEntry)).toBe(true);
    });

    it("returns false for breakpoint messages", () => {
      expect(isFlowsheetTalksetEntry(breakpointEntry)).toBe(false);
    });

    it("returns false for song entries", () => {
      expect(isFlowsheetTalksetEntry(songEntry)).toBe(false);
    });

    it("does not crash when message is null", () => {
      expect(isFlowsheetTalksetEntry(nullMessageEntry)).toBe(false);
    });

    it("does not crash when message is undefined", () => {
      expect(isFlowsheetTalksetEntry(undefinedMessageEntry)).toBe(false);
    });
  });

  describe("isFlowsheetBreakpointEntry", () => {
    it("returns true for breakpoint messages", () => {
      expect(isFlowsheetBreakpointEntry(breakpointEntry)).toBe(true);
    });

    it("returns false for talkset messages", () => {
      expect(isFlowsheetBreakpointEntry(talksetEntry)).toBe(false);
    });

    it("returns false for song entries", () => {
      expect(isFlowsheetBreakpointEntry(songEntry)).toBe(false);
    });

    it("does not crash when message is null", () => {
      expect(isFlowsheetBreakpointEntry(nullMessageEntry)).toBe(false);
    });

    it("does not crash when message is undefined", () => {
      expect(isFlowsheetBreakpointEntry(undefinedMessageEntry)).toBe(false);
    });
  });
});
