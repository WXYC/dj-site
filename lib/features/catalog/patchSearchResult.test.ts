import { describe, it, expect } from "vitest";
import { createTestAlbum } from "@/lib/test-utils";
import type { AlbumEntry } from "./types";
import { mergeAlbumIntoSearchResult } from "./patchSearchResult";

describe("mergeAlbumIntoSearchResult", () => {
  it("updates editable fields while preserving search-only metadata", () => {
    const existing = createTestAlbum({
      id: 42,
      title: "Old Title",
      label: "Old Label",
      entry: 3,
      plays: 12,
      matched_via: [{ source: "library_identity", title: "Old Title" }],
      artwork_url: "https://example.com/art.jpg",
      rotation_id: 99,
    });
    const updated = createTestAlbum({
      id: 42,
      title: "New Title",
      label: "New Label",
      entry: 99,
      plays: 0,
      matched_via: undefined,
      artwork_url: null,
      rotation_id: undefined,
    });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.title).toBe("New Title");
    expect(merged.label).toBe("New Label");
    expect(merged.entry).toBe(3);
    expect(merged.plays).toBe(12);
    expect(merged.matched_via).toEqual(existing.matched_via);
    expect(merged.artwork_url).toBe("https://example.com/art.jpg");
    expect(merged.rotation_id).toBe(99);
  });

  it("clears date_lost and date_found when mutation returns null", () => {
    const existing = createTestAlbum({
      id: 42,
      date_lost: "2024-01-01",
      date_found: undefined,
    });
    const updated = createTestAlbum({
      id: 42,
      date_lost: null,
      date_found: "2024-02-01",
    });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.date_lost).toBeNull();
    expect(merged.date_found).toBe("2024-02-01");
  });

  it("merges albums with empty title fields from LML-only rows", () => {
    const existing = createTestAlbum({
      id: 42,
      title: "Old Title",
      genre_id: 1,
    });
    const updated: AlbumEntry = {
      ...createTestAlbum({ id: 42 }),
      title: "",
      label: "",
      entry: 0,
      artist: {
        name: "",
        lettercode: "AB",
        numbercode: 1,
        genre: "Rock",
        id: 5,
      },
      genre_id: 7,
      format_id: 3,
    };

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.title).toBe("");
    expect(merged.genre_id).toBe(7);
    expect(merged.format_id).toBe(3);
  });
});
