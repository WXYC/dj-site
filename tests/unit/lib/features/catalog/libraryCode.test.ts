import { describe, it, expect } from "vitest";
import {
  formatArtistCodeWithPunctuation,
  formatReleaseCode,
  formatEntireLibraryCode,
} from "@/lib/features/catalog/libraryCode";

describe("formatArtistCodeWithPunctuation — ArtistLibraryCode.java:98", () => {
  it("renders a regular artist code as LETTERS NUMBER/", () => {
    expect(
      formatArtistCodeWithPunctuation({
        code_letters: "ABC",
        code_artist_number: 123,
        genre_id: 1,
      }),
    ).toBe("ABC 123/");
  });

  it("upper-cases the call letters", () => {
    expect(
      formatArtistCodeWithPunctuation({
        code_letters: "mo",
        code_artist_number: 12,
        genre_id: 1,
      }),
    ).toBe("MO 12/");
  });

  it("renders a Various Artists bucket as V/A-, dropping the number", () => {
    expect(
      formatArtistCodeWithPunctuation({
        code_letters: "Z-X",
        code_artist_number: 4,
        genre_id: 1,
      }),
    ).toBe("V/A-");
  });

  // GenreId.SOUNDTRACKS — 12, the same id chooserValidation's
  // isRockCompLettersRequired hardcodes.
  it("renders a Soundtracks compilation as its sub-bucket letter, not V/A", () => {
    expect(
      formatArtistCodeWithPunctuation({
        code_letters: "Z-X",
        code_artist_number: 4,
        genre_id: 12,
      }),
    ).toBe("X-");
  });

  it("treats leading whitespace before Z- as a Various Artists bucket, matching isVariousArtists's trim", () => {
    expect(
      formatArtistCodeWithPunctuation({
        code_letters: "  Z-X",
        code_artist_number: 4,
        genre_id: 1,
      }),
    ).toBe("V/A-");
  });
});

describe("formatReleaseCode — LibraryRelease.java:122", () => {
  it("renders the number alone when the release carries no volume letters", () => {
    expect(formatReleaseCode({ code_number: 5, code_volume_letters: null })).toBe("5");
  });

  it("renders NUMBER-LETTERS when it does, upper-cased", () => {
    expect(formatReleaseCode({ code_number: 5, code_volume_letters: "a" })).toBe("5-A");
  });

  // `isBlank()` in the Java, not `isEmpty()`: a whitespace-only value is no
  // volume letter at all, and rendering `5-` would read as a truncated code.
  it("treats whitespace-only volume letters as absent", () => {
    expect(formatReleaseCode({ code_number: 5, code_volume_letters: "   " })).toBe("5");
  });
});

describe("formatEntireLibraryCode — LibraryRelease.java:129", () => {
  it("joins genre, the artist code, and the release code the way the release table does", () => {
    expect(
      formatEntireLibraryCode({
        genreName: "Rock",
        code_letters: "MO",
        code_artist_number: 12,
        genre_id: 1,
        code_number: 5,
        code_volume_letters: "a",
      }),
    ).toBe("Rock MO 12/5-A");
  });

  // The genre name is looked up from a list that may not have loaded. The
  // shelf code is what a librarian walks to the stacks with, so the rest of
  // it must still render rather than being withheld behind a missing prefix.
  it("omits the genre prefix rather than the whole code when the genre name is unknown", () => {
    expect(
      formatEntireLibraryCode({
        genreName: undefined,
        code_letters: "MO",
        code_artist_number: 12,
        genre_id: 1,
        code_number: 5,
        code_volume_letters: null,
      }),
    ).toBe("MO 12/5");
  });
});
