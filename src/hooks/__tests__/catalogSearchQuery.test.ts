import { describe, it, expect } from "vitest";
import { SearchCatalogQueryParams, SearchIn } from "@/lib/features/catalog/types";

import { formatCatalogSearchQuery } from "../catalogHooks";

describe("catalog search query formatting (Bug 11)", () => {
  it("should set artist_name to undefined when searching Albums only", () => {
    const query = formatCatalogSearchQuery("Albums", "test album", 10);

    expect(query.artist_name).toBeUndefined();
    expect(query.album_name).toBe("test album");
  });

  it("should set album_name to undefined when searching Artists only", () => {
    const query = formatCatalogSearchQuery("Artists", "test artist", 10);

    expect(query.artist_name).toBe("test artist");
    expect(query.album_name).toBeUndefined();
  });

  it("should set both fields to the search string when searching Both", () => {
    const query = formatCatalogSearchQuery("All", "search term", 10);

    expect(query.artist_name).toBe("search term");
    expect(query.album_name).toBe("search term");
  });

  it("should never produce the literal string 'undefined'", () => {
    const queries = [
      formatCatalogSearchQuery("Albums", "test", 10),
      formatCatalogSearchQuery("Artists", "test", 10),
      formatCatalogSearchQuery("All", "test", 10),
    ];

    for (const query of queries) {
      expect(query.artist_name).not.toBe("undefined");
      expect(query.album_name).not.toBe("undefined");
    }
  });
});
