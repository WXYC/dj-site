import { describe, expect, it } from "vitest";
import { findActiveRotationForAlbum, isRealLibraryAlbumId } from "./useCatalogRotationMarking";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { createTestAlbum } from "@/lib/test-utils";

describe("isRealLibraryAlbumId", () => {
  it("accepts positive library ids", () => {
    expect(isRealLibraryAlbumId(42)).toBe(true);
  });

  it("rejects synthetic negative ids", () => {
    expect(isRealLibraryAlbumId(-7000)).toBe(false);
  });
});

describe("findActiveRotationForAlbum", () => {
  it("returns the active rotation row for an album", () => {
    const album = createTestAlbum({ id: 100, rotation_bin: "M", rotation_id: 55 });
    const list: AlbumEntry[] = [album];

    expect(findActiveRotationForAlbum(list, 100)).toEqual({
      bin: "M",
      rotationId: 55,
    });
  });

  it("returns null when the album is not in rotation", () => {
    const list: AlbumEntry[] = [createTestAlbum({ id: 100 })];

    expect(findActiveRotationForAlbum(list, 100)).toBeNull();
  });

});
