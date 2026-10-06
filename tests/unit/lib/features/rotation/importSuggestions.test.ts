import { describe, it, expect } from "vitest";
import { artistShelfCode, suggestCallLetters } from "@/lib/features/rotation/importSuggestions";

describe("suggestCallLetters", () => {
  it.each([
    { name: "Chuquimamani-Condori", expected: "ch" },
    { name: "  Stereolab ", expected: "st" },
    { name: "Nilüfer Yanya", expected: "ni" },
    { name: "X", expected: "x" },
  ])("takes the first two characters of $name, lowercased", ({ name, expected }) => {
    expect(suggestCallLetters(name)).toBe(expected);
  });

  // The shelf files every compilation bucket under the same letters, and the
  // Java's own suggestion returns them verbatim.
  it.each(["Various Artists", "V/A", "V.A.", "various", "Soundtrack", "OST"])(
    "suggests the compilation bucket for %s",
    (name) => {
      expect(suggestCallLetters(name)).toBe("Z-");
    },
  );

  // The strict whole-name predicate is what keeps a band whose name merely
  // contains a keyword off the compilation shelf.
  it("does not send a band with a compilation word in its name to the bucket", () => {
    expect(suggestCallLetters("Various Cruelties")).toBe("va");
  });

  it.each([
    { label: "an empty name", name: "" },
    { label: "whitespace", name: "   " },
    { label: "null", name: null },
    { label: "undefined", name: undefined },
  ])("suggests nothing for $label", ({ name }) => {
    expect(suggestCallLetters(name)).toBe("");
  });
});

describe("artistShelfCode", () => {
  // The artist search serves `code_comp_letter` beside `code_number`, so a
  // Rock section match reads as its own section rather than as every section.
  it.each([
    { label: "a Rock section letter", genre_id: 11, letter: "K", expected: "Rock V/A K-" },
    { label: "a Soundtracks section letter", genre_id: 12, letter: "M", expected: "Soundtracks M-" },
    { label: "no letter served", genre_id: 11, letter: null, expected: "Rock V/A-" },
    { label: "an absent letter", genre_id: 11, letter: undefined, expected: "Rock V/A-" },
  ])("renders $label", ({ genre_id, letter, expected }) => {
    const genre_name = genre_id === 11 ? "Rock" : "Soundtracks";
    expect(
      artistShelfCode({
        code_letters: "V/A",
        code_number: 0,
        genre_id,
        genre_name,
        code_comp_letter: letter,
      }),
    ).toBe(expected);
  });
});
