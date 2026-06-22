import { describe, it, expect } from "vitest";
import { filterBySearchTerms } from "./filterBySearchTerms";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";
import type { AlbumEntry } from "@/lib/features/catalog/types";

describe("filterBySearchTerms", () => {
  const query = { artist: "stereolab", album: "", label: "" };

  it("matches an entry whose artist name contains the search term", () => {
    const match = createTestAlbum({
      artist: createTestArtist({ name: "Stereolab" }),
    });
    expect(filterBySearchTerms([match], query)).toEqual([match]);
  });

  it("ignores search terms of 3 characters or fewer", () => {
    const album = createTestAlbum();
    expect(filterBySearchTerms([album], { artist: "ste", album: "", label: "" })).toEqual([]);
  });

  // Regression: the BS catalog/rotation proxy can deliver a row whose `artist`
  // object is present but `artist.name` is null (library-unlinked rows). The
  // `item.artist?.name.toLowerCase()` chain only guarded `item.artist`, so the
  // null `name` threw `TypeError` mid-filter — which, on the live flowsheet
  // searchbar, bubbled to app/global-error and white-screened the whole site
  // as the DJ typed. (dj-site flowsheet entry crash, 2026-06-21)
  it("does not throw when an entry's artist.name is null", () => {
    const malformed = {
      ...createTestAlbum(),
      artist: { ...createTestArtist(), name: null },
    } as unknown as AlbumEntry;

    expect(() => filterBySearchTerms([malformed], query)).not.toThrow();
  });

  it("excludes a null-named entry but still returns its valid siblings", () => {
    const malformed = {
      ...createTestAlbum({ id: 1 }),
      artist: { ...createTestArtist(), name: null },
    } as unknown as AlbumEntry;
    const valid = createTestAlbum({
      id: 2,
      artist: createTestArtist({ name: "Stereolab" }),
    });

    expect(filterBySearchTerms([malformed, valid], query)).toEqual([valid]);
  });
});
