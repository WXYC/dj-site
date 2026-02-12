import { describe, it, expect } from "vitest";
import {
  convertBinToFlowsheet,
  convertBinToQueue,
} from "@/lib/features/bin/conversions";
import { convertToAlbumEntry } from "@/lib/features/catalog/conversions";
import {
  createTestBinResponse,
  createTestAlbum,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { Rotation } from "@/lib/features/rotation/types";


/** The shape `convertBinToFlowsheet` actually returns (the album_id variant). */
type BinFlowsheetSubmission = {
  album_id: number;
  track_title: string;
  artist_name: string;
  record_label?: string;
  rotation_id?: number;
  request_flag: boolean;
};

describe("bin conversions", () => {
  describe("convertToAlbumEntry", () => {
    it("should convert album_id to id", () => {
      const response = createTestBinResponse({
        album_id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
      });
      const result = convertToAlbumEntry(response);
      expect(result.id).toBe(TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM);
    });

    it("should convert album_title to title", () => {
      const response = createTestBinResponse({
        album_title: "Great Album",
      });
      const result = convertToAlbumEntry(response);
      expect(result.title).toBe("Great Album");
    });

    it("should extract artist name", () => {
      const response = createTestBinResponse({
        artist_name: "Cool Artist",
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.name).toBe("Cool Artist");
    });

    it("should extract artist lettercode", () => {
      const response = createTestBinResponse({
        code_letters: "CA",
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.lettercode).toBe("CA");
    });

    it("should extract artist numbercode", () => {
      const response = createTestBinResponse({
        code_artist_number: 42,
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.numbercode).toBe(42);
    });

    it("should extract artist genre", () => {
      const response = createTestBinResponse({
        genre_name: "Jazz",
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.genre).toBe("Jazz");
    });

    it("should use Unknown for null genre", () => {
      const response = createTestBinResponse({
        genre_name: null as unknown as string,
      });
      const result = convertToAlbumEntry(response);
      expect(result.artist.genre).toBe("Unknown");
    });

    it("should extract entry from code_number", () => {
      const response = createTestBinResponse({
        code_number: 99,
      });
      const result = convertToAlbumEntry(response);
      expect(result.entry).toBe(99);
    });

    it("should extract format", () => {
      const response = createTestBinResponse({
        format_name: "Vinyl",
      });
      const result = convertToAlbumEntry(response);
      expect(result.format).toBe("Vinyl");
    });

    it("should use Unknown for null format", () => {
      const response = createTestBinResponse({
        format_name: null as unknown as string,
      });
      const result = convertToAlbumEntry(response);
      expect(result.format).toBe("Unknown");
    });

    it("should extract label", () => {
      const response = createTestBinResponse({
        label: "Indie Records",
      });
      const result = convertToAlbumEntry(response);
      expect(result.label).toBe("Indie Records");
    });

    it("should handle undefined label as empty string", () => {
      const response = createTestBinResponse({
        label: undefined,
      });
      const result = convertToAlbumEntry(response);
      expect(result.label).toBe("");
    });

    it("should set alternate_artist to empty string", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.alternate_artist).toBe("");
    });

    it("should set rotation_bin to undefined", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.rotation_bin).toBeUndefined();
    });

    it("should set add_date to undefined", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.add_date).toBeUndefined();
    });

    it("should default plays to 0", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.plays).toBe(0);
    });

    it("should set rotation_id to undefined", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.rotation_id).toBeUndefined();
    });

    it("should set artist.id to undefined", () => {
      const response = createTestBinResponse();
      const result = convertToAlbumEntry(response);
      expect(result.artist.id).toBeUndefined();
    });
  });

  describe("convertBinToFlowsheet", () => {
    const createBinEntry = (overrides: Partial<AlbumEntry> = {}): AlbumEntry =>
      createTestAlbum(overrides);

    it("should convert album_id", () => {
      const binEntry = createBinEntry({ id: 123 });
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetSubmission;
      expect(result.album_id).toBe(123);
    });

    it("should use album title as track_title", () => {
      const binEntry = createBinEntry({ title: "Cool Album" });
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetSubmission;
      expect(result.track_title).toBe("Cool Album");
    });

    it("should include artist_name", () => {
      const binEntry = createBinEntry({
        artist: { id: undefined, name: "Awesome Artist", lettercode: "AA", numbercode: 1, genre: "Rock" },
      });
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetSubmission;
      expect(result.artist_name).toBe("Awesome Artist");
    });

    it("should include record_label", () => {
      const binEntry = createBinEntry({ label: "Big Label" });
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetSubmission;
      expect(result.record_label).toBe("Big Label");
    });

    it("should include rotation_id when present", () => {
      const binEntry = createBinEntry({
        rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
      });
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetSubmission;
      expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.HEAVY);
    });

    it("should set request_flag to false", () => {
      const binEntry = createBinEntry();
      const result = convertBinToFlowsheet(binEntry) as BinFlowsheetSubmission;
      expect(result.request_flag).toBe(false);
    });
  });

  describe("convertBinToQueue", () => {
    const createBinEntry = (overrides: Partial<AlbumEntry> = {}): AlbumEntry =>
      createTestAlbum(overrides);

    it("should convert album_id", () => {
      const binEntry = createBinEntry({ id: 456 });
      const result = convertBinToQueue(binEntry);
      expect(result.album_id).toBe(456);
    });

    it("should set song to empty string", () => {
      const binEntry = createBinEntry({ title: "Album Title" });
      const result = convertBinToQueue(binEntry);
      expect(result.song).toBe("");
    });

    it("should use album title as album field", () => {
      const binEntry = createBinEntry({ title: "Album Title" });
      const result = convertBinToQueue(binEntry);
      expect(result.album).toBe("Album Title");
    });

    it("should include artist name", () => {
      const binEntry = createBinEntry({
        artist: { id: undefined, name: "Queue Artist", lettercode: "QA", numbercode: 1, genre: "Electronic" },
      });
      const result = convertBinToQueue(binEntry);
      expect(result.artist).toBe("Queue Artist");
    });

    it("should include label", () => {
      const binEntry = createBinEntry({ label: "Queue Label" });
      const result = convertBinToQueue(binEntry);
      expect(result.label).toBe("Queue Label");
    });

    it("should include rotation_id", () => {
      const binEntry = createBinEntry({
        rotation_id: TEST_ENTITY_IDS.ROTATION.MEDIUM,
      });
      const result = convertBinToQueue(binEntry);
      expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.MEDIUM);
    });

    it("should include rotation_bin", () => {
      const binEntry = createBinEntry({ rotation_bin: Rotation.H });
      const result = convertBinToQueue(binEntry);
      expect(result.rotation_bin).toBe(Rotation.H);
    });

    it("should set request to false", () => {
      const binEntry = createBinEntry();
      const result = convertBinToQueue(binEntry);
      expect(result.request).toBe(false);
    });
  });
});
