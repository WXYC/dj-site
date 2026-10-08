import { describe, it, expect } from "vitest";
import { CODE_NUMBER_MAX } from "@/lib/features/catalog/adminCreateArtistValidation";
import { parseRefiledParams } from "@/lib/features/catalog/refiledConfirmation";

describe("parseRefiledParams", () => {
  it.each([
    { refiled: "1", from: "0", n: "0", expected: { from: 0, releases: 0 } },
    { refiled: "1", from: "1", n: "2", expected: { from: 1, releases: 2 } },
    { refiled: "1", from: " 3", n: "4 ", expected: { from: 3, releases: 4 } },
    { refiled: "1", from: String(CODE_NUMBER_MAX), n: "1", expected: { from: CODE_NUMBER_MAX, releases: 1 } },
    { refiled: "1", from: "-1", n: "1", expected: undefined },
    { refiled: "1", from: "1.5", n: "1", expected: undefined },
    { refiled: "1", from: "3a", n: "1", expected: undefined },
    { refiled: "1", from: "03", n: "1", expected: undefined },
    { refiled: "1", from: "", n: "1", expected: undefined },
    { refiled: "1", from: "1", n: "", expected: undefined },
    { refiled: "1", from: "1", n: "-1", expected: undefined },
    { refiled: "1", from: String(CODE_NUMBER_MAX + 1), n: "1", expected: undefined },
    { refiled: "1", from: "1", n: String(CODE_NUMBER_MAX + 1), expected: undefined },
    { refiled: "1", from: undefined, n: "1", expected: undefined },
    { refiled: "1", from: "1", n: undefined, expected: undefined },
    { refiled: "true", from: "1", n: "1", expected: undefined },
    { refiled: "0", from: "1", n: "1", expected: undefined },
    { refiled: undefined, from: "1", n: "1", expected: undefined },
  ])("refiled=$refiled from=$from n=$n", ({ refiled, from, n, expected }) => {
    expect(parseRefiledParams(refiled, from, n)).toEqual(expected);
  });
});

describe("parseRefiledParams from_letters", () => {
  // string = carried old letters; null = the letters changed but the old ones cannot be shown; absent = they did not change.
  it.each([
    { fromLetters: "RE", expected: { from: 36, releases: 2, fromLetters: "RE" } },
    { fromLetters: "V/A", expected: { from: 36, releases: 2, fromLetters: "V/A" } },
    { fromLetters: "12", expected: { from: 36, releases: 2, fromLetters: "12" } },
    { fromLetters: undefined, expected: { from: 36, releases: 2 } },
    { fromLetters: "", expected: { from: 36, releases: 2, fromLetters: null } },
    { fromLetters: "??", expected: { from: 36, releases: 2, fromLetters: null } },
    { fromLetters: "Z-L", expected: { from: 36, releases: 2, fromLetters: null } },
    { fromLetters: "<b>x</b>", expected: { from: 36, releases: 2, fromLetters: null } },
    { fromLetters: "Jam Money", expected: { from: 36, releases: 2, fromLetters: null } },
    { fromLetters: "TOOLONG", expected: { from: 36, releases: 2, fromLetters: null } },
    { fromLetters: " RE", expected: { from: 36, releases: 2, fromLetters: null } },
  ])("from_letters=$fromLetters", ({ fromLetters, expected }) => {
    expect(parseRefiledParams("1", "36", "2", fromLetters)).toStrictEqual(expected);
  });

  it("a malformed triple still drops the whole banner, whatever from_letters says", () => {
    expect(parseRefiledParams("1", "x", "2", "RE")).toBeUndefined();
  });
});
