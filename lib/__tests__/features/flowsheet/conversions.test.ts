import { describe, it, expect } from "vitest";
import {
  convertQueryToSubmission,
  convertDJsOnAir,
  convertV2Entry,
  convertV2FlowsheetResponse,
} from "@/lib/features/flowsheet/conversions";
import {
  createTestFlowsheetQuery,
  createTestOnAirDJResponse,
  createTestV2TrackEntry,
  createTestV2ShowStartEntry,
  createTestV2ShowEndEntry,
  createTestV2DJJoinEntry,
  createTestV2DJLeaveEntry,
  createTestV2TalksetEntry,
  createTestV2BreakpointEntry,
  createTestV2MessageEntry,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";
import type {
  FlowsheetSongEntry,
  FlowsheetShowBlockEntry,
  FlowsheetBreakpointEntry,
  FlowsheetMessageEntry,
} from "@/lib/features/flowsheet/types";
import { Rotation } from "@/lib/features/rotation/types";

describe("flowsheet conversions", () => {
  describe("convertQueryToSubmission", () => {
    it("should convert query to submission params", () => {
      const query = createTestFlowsheetQuery();
      const result = convertQueryToSubmission(query);

      expect(result.track_title).toBe(TEST_SEARCH_STRINGS.TRACK_TITLE);
      expect(result.artist_name).toBe(TEST_SEARCH_STRINGS.ARTIST_NAME);
      expect(result.album_title).toBe(TEST_SEARCH_STRINGS.ALBUM_NAME);
      expect(result.record_label).toBe(TEST_SEARCH_STRINGS.LABEL);
      expect(result.request_flag).toBe(false);
      expect(result.album_id).toBeUndefined();
      expect(result.rotation_id).toBeUndefined();
    });

    it("should include album_id when present", () => {
      const query = createTestFlowsheetQuery({ album_id: 123 });
      const result = convertQueryToSubmission(query);
      expect(result.album_id).toBe(123);
    });

    it("should include rotation_id when present", () => {
      const query = createTestFlowsheetQuery({
        rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
      });
      const result = convertQueryToSubmission(query);
      expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.HEAVY);
    });

    it("should preserve request flag", () => {
      const query = createTestFlowsheetQuery({ request: true });
      const result = convertQueryToSubmission(query);
      expect(result.request_flag).toBe(true);
    });
  });

  describe("convertDJsOnAir", () => {
    it("should return off air for undefined response", () => {
      const result = convertDJsOnAir(undefined);
      expect(result.djs).toEqual([]);
      expect(result.onAir).toBe("Off Air");
    });

    it("should return off air for empty array", () => {
      const result = convertDJsOnAir([]);
      expect(result.djs).toEqual([]);
      expect(result.onAir).toBe("Off Air");
    });

    it("should format single DJ on air", () => {
      const response = [createTestOnAirDJResponse({ dj_name: "Cool DJ" })];
      const result = convertDJsOnAir(response);

      expect(result.djs).toHaveLength(1);
      expect(result.onAir).toBe("DJ Cool DJ");
    });

    it("should format multiple DJs on air", () => {
      const response = [
        createTestOnAirDJResponse({ id: 1, dj_name: "First DJ" }),
        createTestOnAirDJResponse({ id: 2, dj_name: "Second DJ" }),
      ];
      const result = convertDJsOnAir(response);

      expect(result.djs).toHaveLength(2);
      expect(result.onAir).toBe("DJ First DJ, DJ Second DJ");
    });

    it("should preserve original DJ response objects", () => {
      const response = [createTestOnAirDJResponse({ id: 42, dj_name: "Test" })];
      const result = convertDJsOnAir(response);

      expect(result.djs[0].id).toBe(42);
      expect(result.djs[0].dj_name).toBe("Test");
    });
  });

  describe("V2 flowsheet conversions", () => {
    describe("convertV2Entry", () => {
      it("should convert track entry to FlowsheetSongEntry", () => {
        const entry = createTestV2TrackEntry();
        const result = convertV2Entry(entry) as FlowsheetSongEntry;

        expect(result.id).toBe(TEST_ENTITY_IDS.FLOWSHEET.ENTRY_1);
        expect(result.play_order).toBe(1);
        expect(result.show_id).toBe(TEST_ENTITY_IDS.SHOW.CURRENT_SHOW);
        expect(result.track_title).toBe(TEST_SEARCH_STRINGS.TRACK_TITLE);
        expect(result.artist_name).toBe(TEST_SEARCH_STRINGS.ARTIST_NAME);
        expect(result.album_title).toBe(TEST_SEARCH_STRINGS.ALBUM_NAME);
        expect(result.record_label).toBe(TEST_SEARCH_STRINGS.LABEL);
        expect(result.request_flag).toBe(false);
        expect(result.album_id).toBe(TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM);
      });

      it("should default null/undefined track fields to empty strings", () => {
        const entry = createTestV2TrackEntry({
          track_title: null,
          artist_name: undefined,
          album_title: null,
          record_label: undefined,
        });
        const result = convertV2Entry(entry) as FlowsheetSongEntry;

        expect(result.track_title).toBe("");
        expect(result.artist_name).toBe("");
        expect(result.album_title).toBe("");
        expect(result.record_label).toBe("");
      });

      it("should preserve rotation data on track entries", () => {
        const entry = createTestV2TrackEntry({
          rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
          rotation_bin: "H" as any,
        });
        const result = convertV2Entry(entry) as FlowsheetSongEntry;

        expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.HEAVY);
        expect(result.rotation).toBe(Rotation.H);
      });

      it("should convert show_start to ShowBlockEntry with isStart=true", () => {
        const entry = createTestV2ShowStartEntry({
          dj_name: "DJ Cool",
          timestamp: "6/15/2024, 2:30:00 PM",
        });
        const result = convertV2Entry(entry) as FlowsheetShowBlockEntry;

        expect(result.dj_name).toBe("DJ Cool");
        expect(result.isStart).toBe(true);
        expect(result.day).toBe("6/15/2024");
        expect(result.time).toBe("2:30:00 PM");
      });

      it("should convert show_end to ShowBlockEntry with isStart=false", () => {
        const entry = createTestV2ShowEndEntry({
          dj_name: "DJ Cool",
          timestamp: "6/15/2024, 4:30:00 PM",
        });
        const result = convertV2Entry(entry) as FlowsheetShowBlockEntry;

        expect(result.dj_name).toBe("DJ Cool");
        expect(result.isStart).toBe(false);
        expect(result.day).toBe("6/15/2024");
        expect(result.time).toBe("4:30:00 PM");
      });

      it("should handle empty timestamp in show entries", () => {
        const entry = createTestV2ShowStartEntry({ timestamp: "" });
        const result = convertV2Entry(entry) as FlowsheetShowBlockEntry;

        expect(result.day).toBe("Unknown");
        expect(result.time).toBe("Unknown");
      });

      it("should convert dj_join to ShowBlockEntry with isStart=true", () => {
        const entry = createTestV2DJJoinEntry({ dj_name: "New DJ" });
        const result = convertV2Entry(entry) as FlowsheetShowBlockEntry;

        expect(result.dj_name).toBe("New DJ");
        expect(result.isStart).toBe(true);
        // day/time derived from add_time
        expect(result.day).toBeTruthy();
        expect(result.time).toBeTruthy();
      });

      it("should convert dj_leave to ShowBlockEntry with isStart=false", () => {
        const entry = createTestV2DJLeaveEntry({ dj_name: "Leaving DJ" });
        const result = convertV2Entry(entry) as FlowsheetShowBlockEntry;

        expect(result.dj_name).toBe("Leaving DJ");
        expect(result.isStart).toBe(false);
      });

      it("should format add_time as day/time for dj_join entries", () => {
        const isoString = "2024-06-15T14:30:00.000Z";
        const entry = createTestV2DJJoinEntry({ add_time: isoString });
        const result = convertV2Entry(entry) as FlowsheetShowBlockEntry;

        // Verify day/time are derived from the same date (timezone-independent)
        const date = new Date(isoString);
        const expectedDay = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        expect(result.day).toBe(expectedDay);
      });

      it("should convert talkset to FlowsheetMessageEntry", () => {
        const entry = createTestV2TalksetEntry({ message: "Talkset about music" });
        const result = convertV2Entry(entry) as FlowsheetMessageEntry;

        expect(result.message).toBe("Talkset about music");
        expect(result.id).toBe(TEST_ENTITY_IDS.FLOWSHEET.ENTRY_1);
      });

      it("should convert breakpoint to FlowsheetBreakpointEntry", () => {
        const entry = createTestV2BreakpointEntry({ message: "Breakpoint - Station ID" });
        const result = convertV2Entry(entry) as FlowsheetBreakpointEntry;

        expect(result.message).toBe("Breakpoint - Station ID");
        // day/time derived from add_time
        expect(result.day).toBeTruthy();
        expect(result.time).toBeTruthy();
      });

      it("should handle null breakpoint message", () => {
        const entry = createTestV2BreakpointEntry({ message: null });
        const result = convertV2Entry(entry) as FlowsheetBreakpointEntry;

        expect(result.message).toBe("");
      });

      it("should convert message to FlowsheetMessageEntry", () => {
        const entry = createTestV2MessageEntry({ message: "Custom station message" });
        const result = convertV2Entry(entry) as FlowsheetMessageEntry;

        expect(result.message).toBe("Custom station message");
      });

      it("should handle null show_id", () => {
        const entry = createTestV2TrackEntry({ show_id: null });
        const result = convertV2Entry(entry);

        expect(result.show_id).toBe(0);
      });
    });

    describe("convertV2FlowsheetResponse", () => {
      it("should convert and sort entries by play_order descending", () => {
        const entries = [
          createTestV2TrackEntry({ id: 1, play_order: 1 }),
          createTestV2TrackEntry({ id: 3, play_order: 3 }),
          createTestV2TrackEntry({ id: 2, play_order: 2 }),
        ];
        const result = convertV2FlowsheetResponse(entries);

        expect(result[0].play_order).toBe(3);
        expect(result[1].play_order).toBe(2);
        expect(result[2].play_order).toBe(1);
      });

      it("should handle empty array", () => {
        const result = convertV2FlowsheetResponse([]);
        expect(result).toEqual([]);
      });

      it("should handle mixed entry types", () => {
        const entries = [
          createTestV2ShowStartEntry({ id: 1, play_order: 1 }),
          createTestV2TrackEntry({ id: 2, play_order: 2 }),
          createTestV2BreakpointEntry({ id: 3, play_order: 3 }),
          createTestV2TrackEntry({ id: 4, play_order: 4 }),
          createTestV2ShowEndEntry({ id: 5, play_order: 5 }),
        ];
        const result = convertV2FlowsheetResponse(entries);

        expect(result).toHaveLength(5);
        expect(result[0].play_order).toBe(5);
        expect(result[4].play_order).toBe(1);
      });
    });
  });
});
