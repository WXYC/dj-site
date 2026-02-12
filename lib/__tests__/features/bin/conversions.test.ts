import { describe, it, expect } from "vitest";
import {
  convertAlbumFromBin,
  convertBinToFlowsheet,
  convertBinToQueue,
} from "@/lib/features/bin/conversions";
import {
  createTestBinQueryResponse,
  createTestAlbum,
  TEST_ENTITY_IDS,
} from "@/lib/test-utils";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { Rotation } from "@/lib/features/rotation/types";

describe("bin conversions", () => {
  describe("convertAlbumFromBin", () => {
    it("should convert album_id to id", () => {
      const response = createTestBinQueryResponse({
        album_id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
      });
      const result = convertAlbumFromBin(response);
      expect(result.id).toBe(TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM);
    });

    it("should convert album_title to title", () => {
      const response = createTestBinQueryResponse({
        album_title: "Great Album",
      });
      const result = convertAlbumFromBin(response);
      expect(result.title).toBe("Great Album");
    });

    it("should extract artist name", () => {
      const response = createTestBinQueryResponse({
        artist_name: "Cool Artist",
      });
      const result = convertAlbumFromBin(response);
      expect(result.artist.name).toBe("Cool Artist");
    });

    it("should extract artist lettercode", () => {
      const response = createTestBinQueryResponse({
        code_letters: "CA",
      });
      const result = convertAlbumFromBin(response);
      expect(result.artist.lettercode).toBe("CA");
    });

    it("should extract artist numbercode", () => {
      const response = createTestBinQueryResponse({
        code_artist_number: 42,
      });
      const result = convertAlbumFromBin(response);
      expect(result.artist.numbercode).toBe(42);
    });

    it("should extract artist genre", () => {
      const response = createTestBinQueryResponse({
        genre_name: "Jazz",
      });
      const result = convertAlbumFromBin(response);
      expect(result.artist.genre).toBe("Jazz");
    });

    it("should use Unknown for null genre", () => {
      const response = createTestBinQueryResponse({
        genre_name: null as unknown as string,
      });
      const result = convertAlbumFromBin(response);
      expect(result.artist.genre).toBe("Unknown");
    });

    it("should extract entry from code_number", () => {
      const response = createTestBinQueryResponse({
        code_number: 99,
      });
      const result = convertAlbumFromBin(response);
      expect(result.entry).toBe(99);
    });

    it("should extract format", () => {
      const response = createTestBinQueryResponse({
        format_name: "Vinyl",
      });
      const result = convertAlbumFromBin(response);
      expect(result.format).toBe("Vinyl");
    });

    it("should use Unknown for null format", () => {
      const response = createTestBinQueryResponse({
        format_name: null as unknown as string,
      });
      const result = convertAlbumFromBin(response);
      expect(result.format).toBe("Unknown");
    });

    it("should extract label", () => {
      const response = createTestBinQueryResponse({
        label: "Indie Records",
      });
      const result = convertAlbumFromBin(response);
      expect(result.label).toBe("Indie Records");
    });

    it("should handle undefined label as empty string", () => {
      const response = createTestBinQueryResponse({
        label: undefined,
      });
      const result = convertAlbumFromBin(response);
      expect(result.label).toBe("");
    });

    it("should set alternate_artist to empty string", () => {
      const response = createTestBinQueryResponse();
      const result = convertAlbumFromBin(response);
      expect(result.alternate_artist).toBe("");
    });

    it("should set play_freq to undefined", () => {
      const response = createTestBinQueryResponse();
      const result = convertAlbumFromBin(response);
      expect(result.play_freq).toBeUndefined();
    });

    it("should set add_date to undefined", () => {
      const response = createTestBinQueryResponse();
      const result = convertAlbumFromBin(response);
      expect(result.add_date).toBeUndefined();
    });

    it("should set plays to undefined", () => {
      const response = createTestBinQueryResponse();
      const result = convertAlbumFromBin(response);
      expect(result.plays).toBeUndefined();
    });

    it("should set rotation_id to undefined", () => {
      const response = createTestBinQueryResponse();
      const result = convertAlbumFromBin(response);
      expect(result.rotation_id).toBeUndefined();
    });

    it("should set artist.id to undefined", () => {
      const response = createTestBinQueryResponse();
      const result = convertAlbumFromBin(response);
      expect(result.artist.id).toBeUndefined();
    });
  });

  describe("convertBinToFlowsheet", () => {
    const createBinEntry = (overrides: Partial<AlbumEntry> = {}): AlbumEntry =>
      createTestAlbum(overrides);

    it("should convert album_id", () => {
      const binEntry = createBinEntry({ id: 123 });
      const result = convertBinToFlowsheet(binEntry) as { album_id: number };
      expect(result.album_id).toBe(123);
    });

    it("should use album title as track_title", () => {
      const binEntry = createBinEntry({ title: "Cool Album" });
      const result = convertBinToFlowsheet(binEntry) as { track_title: string };
      expect(result.track_title).toBe("Cool Album");
    });

    it("should include artist_name", () => {
      const binEntry = createBinEntry({
        artist: { name: "Awesome Artist", lettercode: "AA", numbercode: 1, genre: "Rock", id: undefined },
      });
      const result = convertBinToFlowsheet(binEntry) as { artist_name: string };
      expect(result.artist_name).toBe("Awesome Artist");
    });

    it("should include record_label", () => {
      const binEntry = createBinEntry({ label: "Big Label" });
      const result = convertBinToFlowsheet(binEntry) as { record_label: string };
      expect(result.record_label).toBe("Big Label");
    });

    it("should include rotation_id when present", () => {
      const binEntry = createBinEntry({
        rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
      });
      const result = convertBinToFlowsheet(binEntry) as { rotation_id: number };
      expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.HEAVY);
    });

    it("should set request_flag to false", () => {
      const binEntry = createBinEntry();
      const result = convertBinToFlowsheet(binEntry) as { request_flag: boolean };
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
        artist: { name: "Queue Artist", lettercode: "QA", numbercode: 1, genre: "Electronic", id: undefined },
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

    it("should include play_freq", () => {
      const binEntry = createBinEntry({ play_freq: Rotation.H });
      const result = convertBinToQueue(binEntry);
      expect(result.play_freq).toBe(Rotation.H);
    });

    it("should set request to false", () => {
      const binEntry = createBinEntry();
      const result = convertBinToQueue(binEntry);
      expect(result.request).toBe(false);
    });
  });
});
