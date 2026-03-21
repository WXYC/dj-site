import { describe, it, expect } from "vitest";
import { convertLmlItemToAlbumEntry } from "./lml-conversions";
import { createTestLmlLibraryItem } from "@/lib/test-utils";
import type { LmlLibraryItem } from "./types";

describe("convertLmlItemToAlbumEntry", () => {
  it("should map all fields correctly", () => {
    const item = createTestLmlLibraryItem({
      id: 42,
      title: "DOGA",
      artist: "Juana Molina",
      call_letters: "RO",
      artist_call_number: 15,
      release_call_number: 3,
      genre: "Rock",
      format: "CD",
      alternate_artist_name: "J. Molina",
    });

    const result = convertLmlItemToAlbumEntry(item);

    expect(result).toEqual({
      id: 42,
      title: "DOGA",
      artist: {
        name: "Juana Molina",
        lettercode: "RO",
        numbercode: 15,
        genre: "Rock",
        id: undefined,
      },
      entry: 3,
      format: "CD",
      alternate_artist: "J. Molina",
      label: "",
      rotation_bin: undefined,
      rotation_id: undefined,
      plays: undefined,
      add_date: undefined,
    });
  });

  it("should default null fields to safe values", () => {
    const item: LmlLibraryItem = {
      id: 1,
      title: null,
      artist: null,
      call_letters: null,
      artist_call_number: null,
      release_call_number: null,
      genre: null,
      format: null,
      alternate_artist_name: null,
      library_url: "http://localhost/library/1",
    };

    const result = convertLmlItemToAlbumEntry(item);

    expect(result.title).toBe("");
    expect(result.artist.name).toBe("");
    expect(result.artist.lettercode).toBe("");
    expect(result.artist.numbercode).toBe(0);
    expect(result.artist.genre).toBe("Unknown");
    expect(result.entry).toBe(0);
    expect(result.format).toBe("Unknown");
    expect(result.alternate_artist).toBe("");
  });

  it.each([
    ["Vinyl LP", "Vinyl"],
    ["vinyl", "Vinyl"],
    ["12\" Vinyl", "Vinyl"],
    ["CD", "CD"],
    ["cd", "CD"],
    ["CD-R", "CD"],
    ["Cassette", "Unknown"],
    ["", "Unknown"],
  ] as const)("should normalize format %s to %s", (input, expected) => {
    const item = createTestLmlLibraryItem({ format: input });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.format).toBe(expected);
  });

  it.each([
    "Rock",
    "Electronic",
    "Jazz",
    "Hiphop",
    "Blues",
    "Classical",
    "Reggae",
    "Soundtracks",
    "OCS",
  ] as const)("should pass through valid genre %s", (genre) => {
    const item = createTestLmlLibraryItem({ genre });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.artist.genre).toBe(genre);
  });

  it("should default invalid genre to Unknown", () => {
    const item = createTestLmlLibraryItem({ genre: "Country" });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.artist.genre).toBe("Unknown");
  });

  it("should always set label to empty string", () => {
    const item = createTestLmlLibraryItem();
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.label).toBe("");
  });

  it("should always set rotation_bin, rotation_id, plays, and add_date to undefined", () => {
    const item = createTestLmlLibraryItem();
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.rotation_bin).toBeUndefined();
    expect(result.rotation_id).toBeUndefined();
    expect(result.plays).toBeUndefined();
    expect(result.add_date).toBeUndefined();
  });
});
