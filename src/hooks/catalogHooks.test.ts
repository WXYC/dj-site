import { describe, it, expect } from "vitest";
import { formatCatalogSearchQuery } from "./catalogHooks";

describe("formatCatalogSearchQuery", () => {
  describe("search in modes", () => {
    it.each([
      ["Albums", undefined, "test", 10],
      ["Artists", "test", undefined, 10],
      ["All", "test", "test", 10],
    ] as const)(
      "should format query for %s mode",
      (searchIn, expectedArtist, expectedAlbum, expectedN) => {
        const result = formatCatalogSearchQuery(searchIn, "test", 10);
        expect(result.artist_name).toBe(expectedArtist);
        expect(result.album_title).toBe(expectedAlbum);
        expect(result.n).toBe(expectedN);
      }
    );
  });

  describe("exclusive filter", () => {
    it("should not include on_streaming when exclusive is false", () => {
      const result = formatCatalogSearchQuery("All", "test", 10, false);
      expect(result.on_streaming).toBeUndefined();
    });

    it("should not include on_streaming when exclusive is omitted", () => {
      const result = formatCatalogSearchQuery("All", "test", 10);
      expect(result.on_streaming).toBeUndefined();
    });

    it("should include on_streaming: false when exclusive is true", () => {
      const result = formatCatalogSearchQuery("All", "test", 10, true);
      expect(result.on_streaming).toBe(false);
    });

    it.each(["Albums", "Artists", "All"] as const)(
      "should include on_streaming: false for %s mode when exclusive is true",
      (searchIn) => {
        const result = formatCatalogSearchQuery(searchIn, "test", 10, true);
        expect(result.on_streaming).toBe(false);
      }
    );
  });
});
