import { describe, it, expect } from "vitest";
import {
  ARTIST_NAME_MAX_LENGTH,
  CODE_LETTERS_MAX_LENGTH,
  CODE_NUMBER_MAX,
  isArtistNameConflictData,
  normalizeCodeLetters,
  parseRequiredNonNegativeInt,
  parseRequiredPositiveInt,
  validateNewArtistFields,
} from "@/lib/features/catalog/adminCreateArtistValidation";

describe("parseRequiredPositiveInt", () => {
  it.each([
    ["42", 42],
    ["1", 1],
    ["  99  ", 99],
  ])("accepts decimal positive integer %j → %i", (raw, expected) => {
    expect(parseRequiredPositiveInt(raw)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "0",
    "-1",
    "1.5",
    "1e3",
    "0x10",
    "abc",
    "12abc",
  ])("rejects non-decimal or non-positive input %j", (raw) => {
    expect(parseRequiredPositiveInt(raw)).toBeNull();
  });

  it("rejects leading-zero decimals (not valid code-number literals)", () => {
    expect(parseRequiredPositiveInt("007")).toBeNull();
  });
});

describe("parseRequiredNonNegativeInt", () => {
  it.each([
    ["0", 0],
    ["42", 42],
    ["  99  ", 99],
  ])("accepts decimal non-negative integer %j → %i", (raw, expected) => {
    expect(parseRequiredNonNegativeInt(raw)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "-1",
    "1.5",
    "1e3",
    "0x10",
    "abc",
    "12abc",
  ])("rejects non-decimal or negative input %j", (raw) => {
    expect(parseRequiredNonNegativeInt(raw)).toBeNull();
  });

  it("rejects leading-zero decimals", () => {
    expect(parseRequiredNonNegativeInt("007")).toBeNull();
  });
});

describe("normalizeCodeLetters", () => {
  it("files call letters uppercase", () => {
    expect(normalizeCodeLetters("mo")).toBe("MO");
  });

  it.each(["V/A", "??", "MO2"])(
    "preserves %j, which is a real filed code",
    (code) => {
      // Narrowing this field to A-Z would make those releases impossible to
      // file. The permissiveness is load-bearing.
      expect(normalizeCodeLetters(code)).toBe(code);
    },
  );
});

describe("validateNewArtistFields", () => {
  const valid = {
    alphabeticalName: "Yanya, Nilüfer",
    codeLetters: "YA",
    codeNumberRaw: "42",
  };

  it("accepts a filable trio and hands back the trimmed values", () => {
    const result = validateNewArtistFields({
      ...valid,
      alphabeticalName: "  Yanya, Nilüfer  ",
      codeLetters: "  YA  ",
    });

    expect(result).toMatchObject({
      trimmedAlphabeticalName: "Yanya, Nilüfer",
      trimmedCodeLetters: "YA",
      alphabeticalNameTooLong: false,
      codeLettersTooLong: false,
      codeNumber: 42,
      codeNumberInvalid: false,
    });
  });

  it("rejects an alphabetical name past the column's width", () => {
    const result = validateNewArtistFields({
      ...valid,
      alphabeticalName: "y".repeat(ARTIST_NAME_MAX_LENGTH + 1),
    });

    expect(result.alphabeticalNameTooLong).toBe(true);
  });

  it("rejects call letters past the column's width", () => {
    const result = validateNewArtistFields({
      ...valid,
      codeLetters: "Y".repeat(CODE_LETTERS_MAX_LENGTH + 1),
    });

    expect(result.codeLettersTooLong).toBe(true);
  });

  it("separates an out-of-range code number from a non-integer one", () => {
    // Both are invalid, but only one of them parsed — which is what lets the
    // field name the range ceiling instead of repeating the integer error.
    const outOfRange = validateNewArtistFields({
      ...valid,
      codeNumberRaw: String(CODE_NUMBER_MAX + 1),
    });
    expect(outOfRange.parsedCodeNumber).toBe(CODE_NUMBER_MAX + 1);
    expect(outOfRange.codeNumber).toBeNull();
    expect(outOfRange.codeNumberInvalid).toBe(true);

    const notAnInteger = validateNewArtistFields({
      ...valid,
      codeNumberRaw: "abc",
    });
    expect(notAnInteger.parsedCodeNumber).toBeNull();
    expect(notAnInteger.codeNumberInvalid).toBe(true);
  });

  it("accepts the ceiling itself", () => {
    const result = validateNewArtistFields({
      ...valid,
      codeNumberRaw: String(CODE_NUMBER_MAX),
    });

    expect(result.codeNumber).toBe(CODE_NUMBER_MAX);
  });

  it("does not report an untouched code number as invalid", () => {
    // An empty field is incomplete, not wrong — the submit gate blocks on
    // `codeNumber === null`, and an error under a field nobody has typed in
    // would fire before the MD has done anything.
    const result = validateNewArtistFields({ ...valid, codeNumberRaw: "  " });

    expect(result.codeNumber).toBeNull();
    expect(result.codeNumberInvalid).toBe(false);
  });
});

describe("isArtistNameConflictData", () => {
  it("is true when the body carries the name-conflict reason", () => {
    expect(
      isArtistNameConflictData({
        reason: "artist_name_conflict",
        artist: { artist_id: 5, artist_name: "Stereolab", code_letters: "ST" },
      }),
    ).toBe(true);
  });

  it.each([
    [
      "a body with no reason field at all, which is what a backend predating the discriminant sends",
      { artist: { artist_id: 5, artist_name: "Stereolab", code_letters: "ST" } },
    ],
    [
      "the code-triple conflict's own discriminant, which must not route to the name-conflict remedy",
      {
        reason: "artist_code_conflict",
        artist: { artist_id: 5, artist_name: "Stereolab", code_letters: "ST" },
      },
    ],
    ["a non-object body", "Artist code already exists for that genre and code letters."],
    ["null", null],
    ["undefined", undefined],
  ])("is false for %s", (_label, data) => {
    expect(isArtistNameConflictData(data)).toBe(false);
  });
});
