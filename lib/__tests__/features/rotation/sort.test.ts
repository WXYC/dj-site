import { describe, it, expect } from "vitest";
import { sortRotationReleases } from "@/lib/features/rotation/sort";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import type { AlbumEntry } from "@/lib/features/catalog/types";

describe("sortRotationReleases", () => {
  it("sorts alphabetically by artist name", () => {
    const releases = [
      createTestAlbum({
        id: 1,
        title: "Aluminum Tunes",
        artist: createTestArtist({ name: "Stereolab" }),
      }),
      createTestAlbum({
        id: 2,
        title: "Confield",
        artist: createTestArtist({ name: "Autechre" }),
      }),
      createTestAlbum({
        id: 3,
        title: "Moon Pix",
        artist: createTestArtist({ name: "Cat Power" }),
      }),
    ];
    const sorted = sortRotationReleases(releases);
    expect(sorted.map((r) => r.artist.name)).toEqual([
      "Autechre",
      "Cat Power",
      "Stereolab",
    ]);
  });

  it("breaks artist-name ties by album title", () => {
    const releases = [
      createTestAlbum({
        id: 1,
        title: "Mars Audiac Quintet",
        artist: createTestArtist({ name: "Stereolab" }),
      }),
      createTestAlbum({
        id: 2,
        title: "Aluminum Tunes",
        artist: createTestArtist({ name: "Stereolab" }),
      }),
    ];
    const sorted = sortRotationReleases(releases);
    expect(sorted.map((r) => r.title)).toEqual([
      "Aluminum Tunes",
      "Mars Audiac Quintet",
    ]);
  });

  it("is case-insensitive on the artist name", () => {
    const releases = [
      createTestAlbum({
        id: 1,
        title: "Z",
        artist: createTestArtist({ name: "stereolab" }),
      }),
      createTestAlbum({
        id: 2,
        title: "A",
        artist: createTestArtist({ name: "Autechre" }),
      }),
    ];
    const sorted = sortRotationReleases(releases);
    expect(sorted.map((r) => r.artist.name)).toEqual(["Autechre", "stereolab"]);
  });

  it("does not mutate the input", () => {
    const releases = [
      createTestAlbum({
        id: 1,
        title: "Aluminum Tunes",
        artist: createTestArtist({ name: "Stereolab" }),
      }),
      createTestAlbum({
        id: 2,
        title: "Confield",
        artist: createTestArtist({ name: "Autechre" }),
      }),
    ];
    const before = releases.map((r) => r.artist.name);
    sortRotationReleases(releases);
    expect(releases.map((r) => r.artist.name)).toEqual(before);
  });

  it("handles an empty list", () => {
    expect(sortRotationReleases([])).toEqual([]);
  });

  it("sorts unicode artist names with diacritics next to their base equivalents", () => {
    // Real fixture: BS / Discogs surface artists with stripped or accented
    // names interchangeably (e.g. "Émilie" ↔ "Emilie"). Diacritic-insensitive
    // sort keeps them adjacent. WXYC/dj-site#745.
    const releases = [
      createTestAlbum({
        id: 1,
        title: "Z",
        artist: createTestArtist({ name: "Émilie Simon" }),
      }),
      createTestAlbum({
        id: 2,
        title: "A",
        artist: createTestArtist({ name: "Emilie Levienaise-Farrouch" }),
      }),
    ];
    const sorted = sortRotationReleases(releases);
    expect(sorted[0].artist.name).toBe("Emilie Levienaise-Farrouch");
  });

  // Regression: a library-unlinked rotation row can arrive with a null `artist`
  // object. The comparator runs on every RotationReleaseDropdown render
  // (visibleReleases memo), so an unguarded `a.artist.name` threw and
  // white-screened the page via app/global-error. A 0/1-element list dodges the
  // comparator, so this list has two entries to force it. (dj-site#779)
  it("does not throw when a release has a null artist, sorting it as empty", () => {
    const releases = [
      createTestAlbum({
        id: 1,
        title: "Confield",
        artist: createTestArtist({ name: "Autechre" }),
      }),
      {
        ...createTestAlbum({ id: 2, title: "Untitled" }),
        artist: null,
      } as unknown as AlbumEntry,
    ];
    expect(() => sortRotationReleases(releases)).not.toThrow();
    // The null artist coalesces to "" and sorts ahead of "Autechre".
    expect(sortRotationReleases(releases).map((r) => r.id)).toEqual([2, 1]);
  });
});
