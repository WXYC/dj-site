import { describe, it, expect } from "vitest";
import { createTestAlbum, createTestArtist } from "@/tests/fixtures/fixtures";
import { matchLibraryRelease } from "@/lib/features/reviews/probablyExists";

const row = (artist: string, title: string, overrides = {}) => createTestAlbum({ title, artist: createTestArtist({ name: artist }), ...overrides });

describe("matchLibraryRelease", () => {
  it.each([
    ["the same name", [row("Juana Molina", "DOGA")], "Juana Molina", "DOGA", "DOGA"],
    ["a different case", [row("Juana Molina", "DOGA")], "juana molina", "doga", "DOGA"],
    ["an accent on one side", [row("Csillagrablók", "Hajnal")], "Csillagrablok", "Hajnal", "Hajnal"],
    ["padded whitespace", [row("Juana Molina", "DOGA")], "  Juana Molina ", " DOGA\t", "DOGA"],
    ["a match after rows that do not", [row("Juana Molina", "Halo"), row("Stereolab", "DOGA"), row("Juana Molina", "DOGA")], "Juana Molina", "DOGA", "DOGA"],
  ])("finds a release for %s", (_case, rows, artist, album, title) => {
    expect(matchLibraryRelease(rows, artist, album)?.title).toBe(title);
  });

  it.each([
    ["a different title", [row("Juana Molina", "Halo")], "Juana Molina", "DOGA"],
    ["the same title by a different artist", [row("Stereolab", "DOGA")], "Juana Molina", "DOGA"],
    ["a fuzzy extra that only contains the title", [row("Juana Molina", "DOGA (Deluxe)")], "Juana Molina", "DOGA"],
    ["a row with no library id", [row("Juana Molina", "DOGA", { id: null })], "Juana Molina", "DOGA"],
    ["a row from the LML search", [row("Juana Molina", "DOGA", { lml_source: true })], "Juana Molina", "DOGA"],
    ["no rows", [], "Juana Molina", "DOGA"],
  ])("finds nothing for %s", (_case, rows, artist, album) => {
    expect(matchLibraryRelease(rows, artist, album)).toBeUndefined();
  });
});
