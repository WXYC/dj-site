import { describe, it, expect } from "vitest";
import {
  findSuggestedShelfId,
  suggestShelfLetter,
} from "@/lib/features/catalog/compilationShelf";
import type { ArtistByCodeOwner } from "@/lib/features/catalog/types";

const ROCK_SHELVES: ArtistByCodeOwner[] = ["F", "H", "L", "N", "O", "T"].map(
  (letter, index) => ({
    id: 8100 + index,
    artist_name: `Various Artists - Rock - ${letter}`,
    code_letters: "V/A",
    code_number: 0,
    genre_id: 11,
  }),
);

const SOUNDTRACK_SHELVES: ArtistByCodeOwner[] = ["K"].map((letter) => ({
  id: 8200,
  artist_name: `Soundtracks - ${letter}`,
  code_letters: "V/A",
  code_number: 0,
  genre_id: 12,
}));

describe("suggestShelfLetter", () => {
  // Every title here is a real compilation from the catalog, filed by a
  // librarian on the shelf the case asserts.
  it.each([
    ["the ordinary case", "Hell Comes to Your House, vol. 2", "H"],
    ["case is normalized", "history of British Blues", "H"],
    ["leading “The” is not the filing letter", "The Legacy: Black Sabbath tribute", "L"],
    ["leading “A”", "A break from the norm", "B"],
    ["leading “An”", "An Anthology of Noise & Electronic Music, vol. 7", "A"],
    ["a numeral files as its word", "10 more explosive, fantastic hits", "T"],
    ["tens", "20 all time #1 hits", "T"],
    ["hundreds read from the leading digit", "100% pure funk", "O"],
    ["hundreds, non-one leading digit", "415 Music", "F"],
    ["a decade reads as a year", "1950's rock 'n roll collection", "N"],
    ["a numeral fused to letters", "4ad- all virgos are mad", "F"],
    ["leading punctuation is skipped", "…and the ashes fell", "A"],
    // Only an article *before another word* is a non-filing word. Standing
    // alone it is the title, and there is nothing else to file under.
    ["a bare article is the title", "The", "T"],
  ])("%s: %s → %s", (_label, title, expected) => {
    expect(suggestShelfLetter(title)).toBe(expected);
  });

  it.each([
    ["an empty title", ""],
    ["whitespace only", "   "],
    ["a title with no letters at all", "!!! ???"],
  ])("suggests nothing for %s", (_label, title) => {
    expect(suggestShelfLetter(title)).toBeNull();
  });
});

describe("findSuggestedShelfId", () => {
  it("matches the shelf whose name ends in the suggested letter", () => {
    expect(findSuggestedShelfId("Hell Comes to Your House, vol. 2", ROCK_SHELVES)).toBe(
      ROCK_SHELVES[1].id,
    );
  });

  it("matches a Soundtracks shelf by the same rule", () => {
    expect(findSuggestedShelfId("Koyaanisqatsi", SOUNDTRACK_SHELVES)).toBe(8200);
  });

  it("suggests nothing when no shelf carries that letter", () => {
    // Rock is subdivided A-Z in production, but a genre need not be; a letter
    // with no shelf must leave the librarian choosing rather than land on a
    // neighbour.
    expect(findSuggestedShelfId("Zebra Records Sampler", ROCK_SHELVES)).toBeNull();
  });

  it("suggests nothing when the title suggests no letter", () => {
    expect(findSuggestedShelfId("", ROCK_SHELVES)).toBeNull();
  });

  it("never matches a shelf that is not letter-subdivided", () => {
    // The plain bucket is the whole shelf for most genres; reading its last
    // character as a subdivision letter would suggest it for every title
    // ending in S.
    const plain: ArtistByCodeOwner[] = [
      { id: 8301, artist_name: "Various Artists", code_letters: "V/A", code_number: 0, genre_id: 3 },
    ];
    expect(findSuggestedShelfId("Sampler Sessions", plain)).toBeNull();
  });
});
