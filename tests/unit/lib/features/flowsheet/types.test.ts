import { describe, it, expect } from "vitest";
import {
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetEndShowEntry,
  type FlowsheetEntry,
  type FlowsheetSongEntry,
  type FlowsheetShowBlockEntry,
  type FlowsheetMessageEntry,
} from "@/lib/features/flowsheet/types";

describe("flowsheet types", () => {
  const baseEntry = {
    id: 1,
    play_order: 1,
    show_id: 1,
  };

  it("does not accept a row built without entry_type", () => {
    // @ts-expect-error entry_type is required on every row
    const untyped: FlowsheetMessageEntry = { ...baseEntry, message: "Talkset" };

    expect(untyped.entry_type).toBeUndefined();
  });

  describe("isFlowsheetSongEntry", () => {
    it("should return true for song entries", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        entry_type: "track",
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
        entry_type: "message",
        message: "PSA: Community announcement",
      };

      expect(isFlowsheetSongEntry(messageEntry as FlowsheetEntry)).toBe(false);
    });

    it("should return false for show block entries", () => {
      const showEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        entry_type: "show_start",
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
        entry_type: "show_start",
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
        entry_type: "show_end",
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
        entry_type: "track",
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
        entry_type: "show_end",
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
        entry_type: "show_start",
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
        entry_type: "message",
        message: "PSA: Community announcement",
      };

      expect(isFlowsheetEndShowEntry(messageEntry as FlowsheetEntry)).toBe(false);
    });
  });
});
