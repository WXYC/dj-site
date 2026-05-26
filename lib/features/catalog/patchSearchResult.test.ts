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
      matched_via: [{ source: "track", title: "Old Title" }],
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

  it("updates rotation fields when patch is rotation-only", () => {
    const existing = createTestAlbum({
      id: 42,
      title: "Still Here",
      rotation_bin: "L",
      rotation_id: 10,
    });
    const rotationPatch: AlbumEntry = {
      ...createTestAlbum({ id: 42 }),
      title: "",
      label: "",
      entry: 0,
      artist: {
        name: "",
        lettercode: "",
        numbercode: 0,
        genre: "Unknown",
        id: undefined,
      },
      rotation_bin: "H",
      rotation_id: 99,
    };

    const merged = mergeAlbumIntoSearchResult(existing, rotationPatch);

    expect(merged.title).toBe("Still Here");
    expect(merged.rotation_bin).toBe("H");
    expect(merged.rotation_id).toBe(99);
  });

  it("clears rotation on rotation-only patch with undefined bins", () => {
    const existing = createTestAlbum({
      id: 42,
      rotation_bin: "M",
      rotation_id: 5,
    });
    const rotationPatch: AlbumEntry = {
      ...createTestAlbum({ id: 42 }),
      title: "",
      label: "",
      entry: 0,
      artist: {
        name: "",
        lettercode: "",
        numbercode: 0,
        genre: "Unknown",
        id: undefined,
      },
      rotation_bin: undefined,
      rotation_id: undefined,
    };

    const merged = mergeAlbumIntoSearchResult(existing, rotationPatch);

    expect(merged.rotation_bin).toBeUndefined();
    expect(merged.rotation_id).toBeUndefined();
  });
});
