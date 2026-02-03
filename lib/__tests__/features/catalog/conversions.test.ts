import { describe, it, expect } from "vitest";
import {
  convertAlbumFromSearch,
  convertAlbumFromRotation,
} from "@/lib/features/catalog/conversions";
import {
  createTestAlbumQueryResponse,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";
import type { AlbumQueryResponse } from "@/lib/features/catalog/types";

describe("catalog conversions", () => {
  describe("convertAlbumFromSearch", () => {
    it("should convert basic album response", () => {
      const response = createTestAlbumQueryResponse();
      const result = convertAlbumFromSearch(response);

      expect(result.id).toBe(TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM);
      expect(result.title).toBe(TEST_SEARCH_STRINGS.ALBUM_NAME);
      expect(result.artist.name).toBe(TEST_SEARCH_STRINGS.ARTIST_NAME);
      expect(result.artist.lettercode).toBe("TA");
      expect(result.artist.numbercode).toBe(1);
      expect(result.artist.genre).toBe("Rock");
      expect(result.entry).toBe(1);
      expect(result.format).toBe("CD");
      expect(result.label).toBe(TEST_SEARCH_STRINGS.LABEL);
    });

    it("should set play_freq to undefined (search results ignore rotation)", () => {
      const response = createTestAlbumQueryResponse({
        play_freq: "H",
        rotation_id: 123,
      });
      const result = convertAlbumFromSearch(response);

      expect(result.play_freq).toBeUndefined();
      expect(result.rotation_id).toBeUndefined();
    });

    it("should set alternate_artist to empty string", () => {
      const response = createTestAlbumQueryResponse();
      const result = convertAlbumFromSearch(response);
      expect(result.alternate_artist).toBe("");
    });

    it("should use artist id as the id", () => {
      const response = createTestAlbumQueryResponse({ id: 999 });
      const result = convertAlbumFromSearch(response);
      expect(result.artist.id).toBe(999);
    });

    it.each([
      ["CD", "CD"],
      ["Vinyl", "Vinyl"],
      ["Unknown", "Unknown"],
      [undefined as unknown as string, "Unknown"],
    ])("should convert format_name '%s' to '%s'", (format, expected) => {
      const response = createTestAlbumQueryResponse({
        format_name: format as string,
      });
      const result = convertAlbumFromSearch(response);
      expect(result.format).toBe(expected);
    });

    it.each([
      ["Rock", "Rock"],
      ["Jazz", "Jazz"],
      ["Electronic", "Electronic"],
      ["Hiphop", "Hiphop"],
      [undefined as unknown as string, "Unknown"],
    ])("should convert genre_name '%s' to '%s'", (genre, expected) => {
      const response = createTestAlbumQueryResponse({
        genre_name: genre as string,
      });
      const result = convertAlbumFromSearch(response);
      expect(result.artist.genre).toBe(expected);
    });

    it("should default plays to 0 when undefined", () => {
      const response = createTestAlbumQueryResponse({ plays: undefined });
      const result = convertAlbumFromSearch(response);
      expect(result.plays).toBe(0);
    });

    it("should preserve plays count when present", () => {
      const response = createTestAlbumQueryResponse({ plays: 42 });
      const result = convertAlbumFromSearch(response);
      expect(result.plays).toBe(42);
    });

    it("should preserve add_date", () => {
      const response = createTestAlbumQueryResponse({
        add_date: "2024-01-15",
      });
      const result = convertAlbumFromSearch(response);
      expect(result.add_date).toBe("2024-01-15");
    });
  });

  describe("convertAlbumFromRotation", () => {
    it("should convert basic rotation album response", () => {
      const response = createTestAlbumQueryResponse({
        play_freq: "H",
        rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
      });
      const result = convertAlbumFromRotation(response);

      expect(result.id).toBe(TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM);
      expect(result.title).toBe(TEST_SEARCH_STRINGS.ALBUM_NAME);
      expect(result.play_freq).toBe("H");
      expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.HEAVY);
    });

    it("should preserve rotation data (unlike convertAlbumFromSearch)", () => {
      const response = createTestAlbumQueryResponse({
        play_freq: "M",
        rotation_id: 456,
      });
      const result = convertAlbumFromRotation(response);

      expect(result.play_freq).toBe("M");
      expect(result.rotation_id).toBe(456);
    });

    it.each([
      ["H", "Heavy"],
      ["M", "Medium"],
      ["L", "Light"],
    ] as const)("should preserve rotation '%s'", (rotation) => {
      const response = createTestAlbumQueryResponse({
        play_freq: rotation,
      });
      const result = convertAlbumFromRotation(response);
      expect(result.play_freq).toBe(rotation);
    });

    it("should convert artist data", () => {
      const response = createTestAlbumQueryResponse({
        artist_name: "Test Artist",
        code_letters: "XX",
        code_artist_number: 99,
        genre_name: "Jazz",
      });
      const result = convertAlbumFromRotation(response);

      expect(result.artist.name).toBe("Test Artist");
      expect(result.artist.lettercode).toBe("XX");
      expect(result.artist.numbercode).toBe(99);
      expect(result.artist.genre).toBe("Jazz");
    });

    it("should set alternate_artist to empty string", () => {
      const response = createTestAlbumQueryResponse();
      const result = convertAlbumFromRotation(response);
      expect(result.alternate_artist).toBe("");
    });

    it("should default plays to 0 when undefined", () => {
      const response = createTestAlbumQueryResponse({ plays: undefined });
      const result = convertAlbumFromRotation(response);
      expect(result.plays).toBe(0);
    });

    it("should preserve add_date", () => {
      const response = createTestAlbumQueryResponse({
        add_date: "2024-02-20",
      });
      const result = convertAlbumFromRotation(response);
      expect(result.add_date).toBe("2024-02-20");
    });

    it.each([
      ["CD", "CD"],
      ["Vinyl", "Vinyl"],
    ])("should convert format '%s'", (format) => {
      const response = createTestAlbumQueryResponse({ format_name: format });
      const result = convertAlbumFromRotation(response);
      expect(result.format).toBe(format);
    });
  });

  describe("conversion differences", () => {
    it("convertAlbumFromSearch should ignore rotation data", () => {
      const response = createTestAlbumQueryResponse({
        play_freq: "H",
        rotation_id: 123,
      });
      const searchResult = convertAlbumFromSearch(response);
      expect(searchResult.play_freq).toBeUndefined();
      expect(searchResult.rotation_id).toBeUndefined();
    });

    it("convertAlbumFromRotation should preserve rotation data", () => {
      const response = createTestAlbumQueryResponse({
        play_freq: "H",
        rotation_id: 123,
      });
      const rotationResult = convertAlbumFromRotation(response);
      expect(rotationResult.play_freq).toBe("H");
      expect(rotationResult.rotation_id).toBe(123);
    });
  });
});
