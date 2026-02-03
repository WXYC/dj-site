import { describe, it, expect } from "vitest";
import { submitFromBin, submitFromCatalog } from "@/lib/features/flowsheet/connections";
import { createTestAlbum } from "@/lib/test-utils";

describe("flowsheet connections", () => {
  describe("submitFromBin", () => {
    it("should create submission params from album entry", () => {
      const album = createTestAlbum({ id: 123 });
      const result = submitFromBin(album, "Test Track", false, "Test Label");

      expect(result).toEqual({
        album_id: 123,
        track_title: "Test Track",
        request_flag: false,
        record_label: "Test Label",
      });
    });

    it("should handle request flag as true", () => {
      const album = createTestAlbum({ id: 456 });
      const result = submitFromBin(album, "Request Track", true);

      expect(result).toEqual({
        album_id: 456,
        track_title: "Request Track",
        request_flag: true,
        record_label: undefined,
      });
    });

    it("should handle missing label", () => {
      const album = createTestAlbum({ id: 789 });
      const result = submitFromBin(album, "Track Without Label", false);

      expect(result.record_label).toBeUndefined();
    });
  });

  describe("submitFromCatalog", () => {
    it("should create submission params same as submitFromBin", () => {
      const album = createTestAlbum({ id: 111 });
      const result = submitFromCatalog(album, "Catalog Track", false, "Catalog Label");

      expect(result).toEqual({
        album_id: 111,
        track_title: "Catalog Track",
        request_flag: false,
        record_label: "Catalog Label",
      });
    });

    it("should handle request flag as true", () => {
      const album = createTestAlbum({ id: 222 });
      const result = submitFromCatalog(album, "Catalog Request", true, "Label");

      expect(result.request_flag).toBe(true);
    });
  });
});
