import { describe, it, expect } from "vitest";
import {
  ARTIST_NAME_MAX_LENGTH,
  CODE_LETTERS_MAX_LENGTH,
  CODE_NUMBER_MAX,
  isArtistNameConflictData,
  normalizeCodeLetters,
  parseReleaseCodeNumber,
  parseRequiredNonNegativeInt,
  parseRequiredPositiveInt,
  RELEASE_CODE_NUMBER_MAX,
  releaseVolumeLettersTooLong,
  suggestCodeLetters,
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

  // The column is `varchar(4)` -- four characters, not four UTF-16 units --
  // and Backend measures it with a code-point count, so a surrogate pair must
  // cost one of the four slots rather than two. Measured in UTF-16 units these
  // four mathematical-bold capitals are 8 long, and the form would refuse
  // input the server would have stored.
  it("counts call letters in code points, matching how the backend measures the column", () => {
    const result = validateNewArtistFields({ ...valid, codeLetters: "𝐀𝐁𝐂𝐃" });

    expect(result.codeLettersTooLong).toBe(false);
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

  it("accepts a deliberate 0 with the opt-in, the compilation bucket's own number", () => {
    // 0 is a legal server-side code — the compilation bucket lives at
    // artist_genre_code = 0, and Backend-Service imposes no floor above it —
    // so the filing bench opts in to accepting it.
    const result = validateNewArtistFields(
      { ...valid, codeNumberRaw: "0" },
      { allowZeroCodeNumber: true },
    );

    expect(result.codeNumber).toBe(0);
    expect(result.codeNumberInvalid).toBe(false);
  });

  it("rejects 0 by default, the artist-add form's positive-only field", () => {
    // Without the opt-in the validator stays positive: the artist-add form
    // files real artists, never the compilation bucket, so a stray 0 there is
    // a typo to catch rather than a code to file.
    const result = validateNewArtistFields({ ...valid, codeNumberRaw: "0" });

    expect(result.parsedCodeNumber).toBeNull();
    expect(result.codeNumber).toBeNull();
    expect(result.codeNumberInvalid).toBe(true);
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

describe("suggestCodeLetters", () => {
  it.each([
    ["Juana Molina", "JU"],
    ["Nilüfer Yanya", "NI"],
    ["Csillagrablók", "CS"],
    ["The Clean", "CL"],
    ["stereolab", "ST"],
    ["X", "X"],
    ["!!!", ""],
    ["", ""],
  ])("suggests %j → %j", (name, expected) => {
    expect(suggestCodeLetters(name)).toBe(expected);
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

describe("parseReleaseCodeNumber", () => {
  it("accepts a whole number within the release column's smallint range", () => {
    expect(parseReleaseCodeNumber("42")).toBe(42);
    expect(parseReleaseCodeNumber(String(RELEASE_CODE_NUMBER_MAX))).toBe(
      RELEASE_CODE_NUMBER_MAX,
    );
  });

  it("rejects a value over the smallint ceiling, distinct from CODE_NUMBER_MAX", () => {
    expect(parseReleaseCodeNumber(String(RELEASE_CODE_NUMBER_MAX + 1))).toBeNull();
    // The artist-creation ceiling is far wider than the release column
    // actually allows -- the two must not be interchangeable.
    expect(RELEASE_CODE_NUMBER_MAX).toBeLessThan(CODE_NUMBER_MAX);
  });

  it.each(["", "0", "-1", "abc"])("rejects %j", (raw) => {
    expect(parseReleaseCodeNumber(raw)).toBeNull();
  });

  // The old inline check this helper replaced (`Number(trimmed)` +
  // `Number.isInteger` + range) accepted every one of these: zero-padded
  // digits, a decimal point, a leading `+`, scientific notation, and hex
  // notation. Pinning the narrowing here means a later change that
  // reinstates `Number()`-style parsing to fix one of them (e.g. to accept
  // "007" again) cannot silently readmit the other four on a `smallint`
  // column without failing this suite.
  it.each(["007", "12.0", "+5", "1e3", "0x10"])(
    "rejects %j, which the old Number()-based check accepted",
    (raw) => {
      expect(parseReleaseCodeNumber(raw)).toBeNull();
    },
  );
});

describe("releaseVolumeLettersTooLong", () => {
  it("accepts up to the varchar(4) ceiling", () => {
    expect(releaseVolumeLettersTooLong("")).toBe(false);
    expect(releaseVolumeLettersTooLong("ABCD")).toBe(false);
  });

  it("rejects anything past the ceiling", () => {
    expect(releaseVolumeLettersTooLong("ABCDE")).toBe(true);
  });

  it("counts in code points, not UTF-16 units, matching how the backend measures the column", () => {
    // Each of these four characters is a surrogate pair (mathematical bold
    // capitals): 8 UTF-16 units, 4 code points.
    expect(releaseVolumeLettersTooLong("𝐀𝐁𝐂𝐃")).toBe(false);
  });

});
