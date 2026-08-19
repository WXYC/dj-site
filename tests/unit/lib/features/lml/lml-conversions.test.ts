import { describe, it, expect } from "vitest";
import { convertLmlItemToAlbumEntry } from "@/lib/features/lml/lml-conversions";
import { createTestLmlLibraryItem } from "@/tests/helpers";
import type { LmlLibraryItem } from "@/lib/features/lml/types";

describe("convertLmlItemToAlbumEntry", () => {
  // The one source whose `id` is a legacy id gets marked, so the freeze
  // path's interim write-gate can withhold it from album_id.
  it("marks the entry as LML-sourced for the write gate", () => {
    const result = convertLmlItemToAlbumEntry(createTestLmlLibraryItem({ id: 7 }));
    expect(result.lml_source).toBe(true);
  });


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
      legacy_release_id: 42,
      lml_source: true,
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
  ] as const)("should pass the genre %s through", (genre) => {
    const item = createTestLmlLibraryItem({ genre });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.artist.genre).toBe(genre);
  });

  // The library's genre vocabulary is server-owned — GET /library/genres is the
  // authority, and it lists more genres than the modern experience has chip
  // colors for. A genre with no designed chip color must still arrive as
  // itself; substituting the "Unknown" sentinel is data loss, and it makes a
  // correctly-filed release indistinguishable from one with no genre at all.
  //
  // Pinned by value, not by shape: an `expect.any(String)` assertion here
  // would also pass while the sentinel was being substituted, which is the
  // exact failure this guards.
  it.each(["Africa", "Asia", "Comedy", "Latin", "Spoken", "Xmas"])(
    "should carry the genre %s through even though no chip color is defined for it",
    (genre) => {
      const item = createTestLmlLibraryItem({ genre });
      const result = convertLmlItemToAlbumEntry(item);
      expect(result.artist.genre).toBe(genre);
    },
  );

  // The fallback exists for a row with NO genre, and before this its only
  // exercise was a test asserting the defect -- that a real-but-unstyled genre
  // became "Unknown" -- so replacing that with passthrough cases alone left the
  // branch deletable with a green suite.
  it("falls back to Unknown for a null genre", () => {
    const item = createTestLmlLibraryItem({ genre: null });
    expect(convertLmlItemToAlbumEntry(item).artist.genre).toBe("Unknown");
  });

  // An empty string is NOT absence, and must not be collapsed into the
  // sentinel here. The classic screens are a xerox of the JSPs, whose <c:out>
  // prints nothing for an empty genre; MissingReleases pins that. Degrading an
  // empty genre is the presentation layer's job -- see genreTone and
  // ArtistAvatar -- not the adapter's.
  it("passes an empty genre through rather than inventing the sentinel", () => {
    const item = createTestLmlLibraryItem({ genre: "" });
    expect(convertLmlItemToAlbumEntry(item).artist.genre).toBe("");
  });

  it("should carry a genre dj-site has never heard of through unmodified", () => {
    // The genre table grows without a dj-site deploy, so a value this build
    // doesn't recognize is a genre added since it shipped, not one to discard.
    const item = createTestLmlLibraryItem({ genre: "Country" });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.artist.genre).toBe("Country");
  });

  it("should default a missing label to empty string", () => {
    const item = createTestLmlLibraryItem();
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.label).toBe("");
  });

  it("should pass the record label through (dj-site#605)", () => {
    const item = createTestLmlLibraryItem({ label: "Sonamos" });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.label).toBe("Sonamos");
  });

  it("should default a null label to empty string", () => {
    const item = createTestLmlLibraryItem({ label: null });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.label).toBe("");
  });

  it("should pass on_streaming:false through so the EXCLUSIVE chip renders (dj-site#605)", () => {
    // The catalog/flowsheet result rows render the WXYC EXCLUSIVE chip on
    // `on_streaming === false` (see SearchResults.tsx / Capsule.tsx). Dropping
    // the field silently hid the chip on LML-sourced results.
    const item = createTestLmlLibraryItem({ on_streaming: false });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.on_streaming).toBe(false);
  });

  it("should pass on_streaming:true through", () => {
    const item = createTestLmlLibraryItem({ on_streaming: true });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.on_streaming).toBe(true);
  });

  it.each([[null], [undefined]])(
    "should leave on_streaming undefined (not false) when the field is %s",
    (value) => {
      // A nullish on_streaming must NOT collapse to `false` — that would render
      // a spurious EXCLUSIVE chip on releases whose streaming status is unknown.
      const item = createTestLmlLibraryItem({ on_streaming: value });
      const result = convertLmlItemToAlbumEntry(item);
      expect(result.on_streaming).toBeUndefined();
    },
  );

  it("should pass matched_via track-match hints through (dj-site#605)", () => {
    const matched_via = [{ source: "cta", title: "La Verdad" }];
    const item = createTestLmlLibraryItem({ matched_via });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.matched_via).toEqual(matched_via);
  });

  it("should carry LmlLibraryItem.id into legacy_release_id", () => {
    // LML's `library.db` is keyed by the tubafrenzy LIBRARY_RELEASE_ID, so the
    // `id` it returns is a `legacy_release_id`, not a Backend `library.id`.
    // Populating the field it actually belongs in is this change; `id` keeps
    // its current value for now, so an LML row is the one source where the two
    // spaces legitimately coincide.
    const item = createTestLmlLibraryItem({ id: 45342 });
    const result = convertLmlItemToAlbumEntry(item);
    expect(result.legacy_release_id).toBe(45342);
    expect(result.id).toBe(45342);
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
