import { describe, it, expect } from "vitest";
import {
  submitFromBin,
  submitFromCatalog,
} from "@/lib/features/flowsheet/connections";
import {
  createTestAlbum,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";
import type { AlbumEntry } from "@/lib/features/catalog/types";

describe("flowsheet connections", () => {
  describe("submitFromBin", () => {
    it("should create submission params with album_id from entry", () => {
      const entry = createTestAlbum();
      const result = submitFromBin(entry, "Test Song", false);

      expect(result.album_id).toBe(entry.id);
    });

    it("should include track_title from parameter", () => {
      const entry = createTestAlbum();
      const title = "My Custom Track Title";
      const result = submitFromBin(entry, title, false);

      expect(result.track_title).toBe(title);
    });

    it("should set request_flag to true when isRequest is true", () => {
      const entry = createTestAlbum();
      const result = submitFromBin(entry, "Track", true);

      expect(result.request_flag).toBe(true);
    });

    it("should set request_flag to false when isRequest is false", () => {
      const entry = createTestAlbum();
      const result = submitFromBin(entry, "Track", false);

      expect(result.request_flag).toBe(false);
    });

    it("should include record_label when provided", () => {
      const entry = createTestAlbum();
      const label = "Custom Label";
      const result = submitFromBin(entry, "Track", false, label);

      expect(result.record_label).toBe(label);
    });

    it("should have undefined record_label when not provided", () => {
      const entry = createTestAlbum();
      const result = submitFromBin(entry, "Track", false);

      expect(result.record_label).toBeUndefined();
    });

    it("should handle empty string as track title", () => {
      const entry = createTestAlbum();
      const result = submitFromBin(entry, "", false);

      expect(result.track_title).toBe("");
    });

    it("should handle empty string as label", () => {
      const entry = createTestAlbum();
      const result = submitFromBin(entry, "Track", false, "");

      expect(result.record_label).toBe("");
    });

    it("should create correct submission for typical bin entry", () => {
      const entry = createTestAlbum({
        id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
      });
      const result = submitFromBin(
        entry,
        TEST_SEARCH_STRINGS.TRACK_TITLE,
        true,
        TEST_SEARCH_STRINGS.LABEL
      );

      expect(result).toEqual({
        album_id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
        track_title: TEST_SEARCH_STRINGS.TRACK_TITLE,
        request_flag: true,
        record_label: TEST_SEARCH_STRINGS.LABEL,
      });
    });

    it("should work with various album IDs", () => {
      const albums = [
        createTestAlbum({ id: 1 }),
        createTestAlbum({ id: 999 }),
        createTestAlbum({ id: 0 }),
        createTestAlbum({ id: -1 }),
      ];

      albums.forEach((album) => {
        const result = submitFromBin(album, "Track", false);
        expect(result.album_id).toBe(album.id);
      });
    });
  });

  describe("submitFromCatalog", () => {
    it("should create submission params with album_id from entry", () => {
      const entry = createTestAlbum();
      const result = submitFromCatalog(entry, "Test Song", false);

      expect(result.album_id).toBe(entry.id);
    });

    it("should include track_title from parameter", () => {
      const entry = createTestAlbum();
      const title = "My Catalog Track";
      const result = submitFromCatalog(entry, title, false);

      expect(result.track_title).toBe(title);
    });

    it("should set request_flag to true when isRequest is true", () => {
      const entry = createTestAlbum();
      const result = submitFromCatalog(entry, "Track", true);

      expect(result.request_flag).toBe(true);
    });

    it("should set request_flag to false when isRequest is false", () => {
      const entry = createTestAlbum();
      const result = submitFromCatalog(entry, "Track", false);

      expect(result.request_flag).toBe(false);
    });

    it("should include record_label when provided", () => {
      const entry = createTestAlbum();
      const label = "Catalog Label";
      const result = submitFromCatalog(entry, "Track", false, label);

      expect(result.record_label).toBe(label);
    });

    it("should have undefined record_label when not provided", () => {
      const entry = createTestAlbum();
      const result = submitFromCatalog(entry, "Track", false);

      expect(result.record_label).toBeUndefined();
    });

    it("should handle empty string as track title", () => {
      const entry = createTestAlbum();
      const result = submitFromCatalog(entry, "", false);

      expect(result.track_title).toBe("");
    });

    it("should handle empty string as label", () => {
      const entry = createTestAlbum();
      const result = submitFromCatalog(entry, "Track", false, "");

      expect(result.record_label).toBe("");
    });

    it("should create correct submission for typical catalog entry", () => {
      const entry = createTestAlbum({
        id: TEST_ENTITY_IDS.ALBUM.JAZZ_ALBUM,
      });
      const result = submitFromCatalog(
        entry,
        TEST_SEARCH_STRINGS.TRACK_TITLE,
        false,
        TEST_SEARCH_STRINGS.LABEL
      );

      expect(result).toEqual({
        album_id: TEST_ENTITY_IDS.ALBUM.JAZZ_ALBUM,
        track_title: TEST_SEARCH_STRINGS.TRACK_TITLE,
        request_flag: false,
        record_label: TEST_SEARCH_STRINGS.LABEL,
      });
    });
  });

  describe("submitFromBin vs submitFromCatalog equivalence", () => {
    it("should produce identical output for same inputs", () => {
      const entry = createTestAlbum();
      const title = "Test Track";
      const isRequest = true;
      const label = "Test Label";

      const binResult = submitFromBin(entry, title, isRequest, label);
      const catalogResult = submitFromCatalog(entry, title, isRequest, label);

      expect(binResult).toEqual(catalogResult);
    });

    it("should produce identical output without optional label", () => {
      const entry = createTestAlbum();
      const title = "Track";
      const isRequest = false;

      const binResult = submitFromBin(entry, title, isRequest);
      const catalogResult = submitFromCatalog(entry, title, isRequest);

      expect(binResult).toEqual(catalogResult);
    });

    it("should both handle edge cases identically", () => {
      const entry = createTestAlbum({ id: 0 });
      const title = "";
      const isRequest = false;
      const label = "";

      const binResult = submitFromBin(entry, title, isRequest, label);
      const catalogResult = submitFromCatalog(entry, title, isRequest, label);

      expect(binResult).toEqual(catalogResult);
    });
  });

  describe("FlowsheetSubmissionParams structure", () => {
    it("should only contain expected keys when label is provided", () => {
      const entry = createTestAlbum();
      const result = submitFromBin(entry, "Track", false, "Label");

      const keys = Object.keys(result);
      expect(keys).toHaveLength(4);
      expect(keys).toContain("album_id");
      expect(keys).toContain("track_title");
      expect(keys).toContain("request_flag");
      expect(keys).toContain("record_label");
    });

    it("should only contain expected keys when label is not provided", () => {
      const entry = createTestAlbum();
      const result = submitFromBin(entry, "Track", false);

      const keys = Object.keys(result);
      expect(keys).toHaveLength(4);
      expect(keys).toContain("album_id");
      expect(keys).toContain("track_title");
      expect(keys).toContain("request_flag");
      expect(keys).toContain("record_label");
    });

    it("should have correct types for all fields", () => {
      const entry = createTestAlbum({ id: 123 });
      const result = submitFromBin(entry, "Track Title", true, "Record Label");

      expect(typeof result.album_id).toBe("number");
      expect(typeof result.track_title).toBe("string");
      expect(typeof result.request_flag).toBe("boolean");
      expect(typeof result.record_label).toBe("string");
    });
  });
});
