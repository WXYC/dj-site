import { describe, it, expect } from "vitest";
import {
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetTalksetEntry,
  isFlowsheetBreakpointEntry,
} from "@/lib/features/flowsheet/types";
import {
  createTestFlowsheetEntry,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";

describe("flowsheet type guards", () => {
  describe("isFlowsheetSongEntry", () => {
    it("should return true for song entries with track_title", () => {
      const entry = createTestFlowsheetEntry({
        track_title: "Test Track",
      });
      expect(isFlowsheetSongEntry(entry)).toBe(true);
    });

    it("should return false for entries without track_title", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "Some message",
      };
      expect(isFlowsheetSongEntry(entry as any)).toBe(false);
    });

    it("should return true for empty track_title (still a song)", () => {
      const entry = createTestFlowsheetEntry({
        track_title: "",
      });
      // Empty string is still defined, so it's a song entry
      expect(isFlowsheetSongEntry(entry)).toBe(true);
    });
  });

  describe("isFlowsheetStartShowEntry", () => {
    it("should return true for start show entries", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        dj_name: "Test DJ",
        day: "6/15/2024",
        time: "2:00 PM",
        isStart: true,
      };
      expect(isFlowsheetStartShowEntry(entry)).toBe(true);
    });

    it("should return false for end show entries", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        dj_name: "Test DJ",
        day: "6/15/2024",
        time: "4:00 PM",
        isStart: false,
      };
      expect(isFlowsheetStartShowEntry(entry)).toBe(false);
    });

    it("should return false for song entries", () => {
      const entry = createTestFlowsheetEntry();
      expect(isFlowsheetStartShowEntry(entry)).toBe(false);
    });

    it("should return false for message entries", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "Some message",
      };
      expect(isFlowsheetStartShowEntry(entry as any)).toBe(false);
    });
  });

  describe("isFlowsheetEndShowEntry", () => {
    it("should return true for end show entries", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        dj_name: "Test DJ",
        day: "6/15/2024",
        time: "4:00 PM",
        isStart: false,
      };
      expect(isFlowsheetEndShowEntry(entry)).toBe(true);
    });

    it("should return false for start show entries", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        dj_name: "Test DJ",
        day: "6/15/2024",
        time: "2:00 PM",
        isStart: true,
      };
      expect(isFlowsheetEndShowEntry(entry)).toBe(false);
    });

    it("should return false for song entries", () => {
      const entry = createTestFlowsheetEntry();
      expect(isFlowsheetEndShowEntry(entry)).toBe(false);
    });
  });

  describe("isFlowsheetTalksetEntry", () => {
    it("should return true for talkset entries", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "Talkset about upcoming events",
      };
      expect(isFlowsheetTalksetEntry(entry)).toBe(true);
    });

    it("should return true for message containing 'Talkset' anywhere", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "This is a Talkset entry",
      };
      expect(isFlowsheetTalksetEntry(entry)).toBe(true);
    });

    it("should return false for non-talkset messages", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "Breakpoint at 3:00 PM",
      };
      expect(isFlowsheetTalksetEntry(entry)).toBe(false);
    });

    it("should return false for song entries", () => {
      const entry = createTestFlowsheetEntry();
      expect(isFlowsheetTalksetEntry(entry)).toBe(false);
    });

    it("should be case-sensitive (Talkset vs talkset)", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "talkset about something",
      };
      // The function checks for "Talkset" exactly, so lowercase won't match
      expect(isFlowsheetTalksetEntry(entry)).toBe(false);
    });
  });

  describe("isFlowsheetBreakpointEntry", () => {
    it("should return true for breakpoint entries", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "Breakpoint at 3:00 PM",
        day: "6/15/2024",
        time: "3:00 PM",
      };
      expect(isFlowsheetBreakpointEntry(entry)).toBe(true);
    });

    it("should return true for message containing 'Breakpoint' anywhere", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "Station ID - Breakpoint",
        day: "6/15/2024",
        time: "3:00 PM",
      };
      expect(isFlowsheetBreakpointEntry(entry)).toBe(true);
    });

    it("should return false for non-breakpoint messages", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "Talkset about upcoming events",
      };
      expect(isFlowsheetBreakpointEntry(entry)).toBe(false);
    });

    it("should return false for song entries", () => {
      const entry = createTestFlowsheetEntry();
      expect(isFlowsheetBreakpointEntry(entry)).toBe(false);
    });

    it("should be case-sensitive (Breakpoint vs breakpoint)", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        message: "breakpoint at 3:00 PM",
      };
      // The function checks for "Breakpoint" exactly, so lowercase won't match
      expect(isFlowsheetBreakpointEntry(entry)).toBe(false);
    });
  });

  describe("type guard combinations", () => {
    it("should correctly identify a song entry (not other types)", () => {
      const entry = createTestFlowsheetEntry();

      expect(isFlowsheetSongEntry(entry)).toBe(true);
      expect(isFlowsheetStartShowEntry(entry)).toBe(false);
      expect(isFlowsheetEndShowEntry(entry)).toBe(false);
      expect(isFlowsheetTalksetEntry(entry)).toBe(false);
      expect(isFlowsheetBreakpointEntry(entry)).toBe(false);
    });

    it("should correctly identify a start show entry (not other types)", () => {
      const entry = {
        id: 1,
        play_order: 1,
        show_id: 1,
        dj_name: "Test DJ",
        day: "6/15/2024",
        time: "2:00 PM",
        isStart: true,
      };

      expect(isFlowsheetSongEntry(entry as any)).toBe(false);
      expect(isFlowsheetStartShowEntry(entry)).toBe(true);
      expect(isFlowsheetEndShowEntry(entry)).toBe(false);
      expect(isFlowsheetTalksetEntry(entry as any)).toBe(false);
      expect(isFlowsheetBreakpointEntry(entry as any)).toBe(false);
    });
  });
});
