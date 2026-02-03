import { describe, it, expect } from "vitest";
import {
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetTalksetEntry,
  isFlowsheetBreakpointEntry,
  type FlowsheetEntry,
  type FlowsheetSongEntry,
  type FlowsheetShowBlockEntry,
  type FlowsheetMessageEntry,
  type FlowsheetBreakpointEntry,
} from "@/lib/features/flowsheet/types";

describe("flowsheet types", () => {
  const baseEntry = {
    id: 1,
    play_order: 1,
    show_id: 1,
  };

  describe("isFlowsheetSongEntry", () => {
    it("should return true for song entries", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      expect(isFlowsheetSongEntry(songEntry)).toBe(true);
    });

    it("should return false for message entries", () => {
      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "PSA: Community announcement",
      };

      expect(isFlowsheetSongEntry(messageEntry as FlowsheetEntry)).toBe(false);
    });

    it("should return false for show block entries", () => {
      const showEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        dj_name: "DJ Cool",
        isStart: true,
        day: "Monday",
        time: "10:00",
      };

      expect(isFlowsheetSongEntry(showEntry as FlowsheetEntry)).toBe(false);
    });
  });

  describe("isFlowsheetStartShowEntry", () => {
    it("should return true for start show entries", () => {
      const startShowEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        dj_name: "DJ Cool",
        isStart: true,
        day: "Monday",
        time: "10:00",
      };

      expect(isFlowsheetStartShowEntry(startShowEntry)).toBe(true);
    });

    it("should return false for end show entries", () => {
      const endShowEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        dj_name: "DJ Cool",
        isStart: false,
        day: "Monday",
        time: "22:00",
      };

      expect(isFlowsheetStartShowEntry(endShowEntry)).toBe(false);
    });

    it("should return false for song entries", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      expect(isFlowsheetStartShowEntry(songEntry as FlowsheetEntry)).toBe(false);
    });
  });

  describe("isFlowsheetEndShowEntry", () => {
    it("should return true for end show entries", () => {
      const endShowEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        dj_name: "DJ Cool",
        isStart: false,
        day: "Monday",
        time: "22:00",
      };

      expect(isFlowsheetEndShowEntry(endShowEntry)).toBe(true);
    });

    it("should return false for start show entries", () => {
      const startShowEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        dj_name: "DJ Cool",
        isStart: true,
        day: "Monday",
        time: "10:00",
      };

      expect(isFlowsheetEndShowEntry(startShowEntry)).toBe(false);
    });

    it("should return false for message entries", () => {
      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "PSA: Community announcement",
      };

      expect(isFlowsheetEndShowEntry(messageEntry as FlowsheetEntry)).toBe(false);
    });
  });

  describe("isFlowsheetTalksetEntry", () => {
    it("should return true for talkset entries", () => {
      const talksetEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "Talkset",
      };

      expect(isFlowsheetTalksetEntry(talksetEntry)).toBe(true);
    });

    it("should return true for entries with Talkset in message", () => {
      const talksetEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "Talkset: DJ discussing upcoming event",
      };

      expect(isFlowsheetTalksetEntry(talksetEntry)).toBe(true);
    });

    it("should return false for non-talkset message entries", () => {
      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "PSA: Community announcement",
      };

      expect(isFlowsheetTalksetEntry(messageEntry)).toBe(false);
    });

    it("should return false for song entries", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      expect(isFlowsheetTalksetEntry(songEntry as FlowsheetEntry)).toBe(false);
    });
  });

  describe("isFlowsheetBreakpointEntry", () => {
    it("should return true for breakpoint entries", () => {
      const breakpointEntry: FlowsheetBreakpointEntry = {
        ...baseEntry,
        message: "Breakpoint: Station ID",
        day: "Monday",
        time: "10:00",
      };

      expect(isFlowsheetBreakpointEntry(breakpointEntry)).toBe(true);
    });

    it("should return true for entries with Breakpoint in message", () => {
      const breakpointEntry: FlowsheetBreakpointEntry = {
        ...baseEntry,
        message: "Breakpoint: PSA at 10:30",
        day: "Monday",
        time: "10:30",
      };

      expect(isFlowsheetBreakpointEntry(breakpointEntry)).toBe(true);
    });

    it("should return false for non-breakpoint message entries", () => {
      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "PSA: Community announcement",
      };

      expect(isFlowsheetBreakpointEntry(messageEntry as FlowsheetEntry)).toBe(false);
    });

    it("should return false for talkset entries", () => {
      const talksetEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "Talkset",
      };

      expect(isFlowsheetBreakpointEntry(talksetEntry as FlowsheetEntry)).toBe(false);
    });

    it("should return false for song entries", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      expect(isFlowsheetBreakpointEntry(songEntry as FlowsheetEntry)).toBe(false);
    });
  });
});
