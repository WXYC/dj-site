import { describe, expect, it } from "vitest";
import {
  importedConfirmation,
  parseImportedReleaseParams,
} from "@/lib/features/rotation/importedConfirmation";

describe("parseImportedReleaseParams", () => {
  it("carries a purely alphabetic volume letters value through, upper-cased", () => {
    expect(parseImportedReleaseParams("1", "12", "a")).toEqual({
      rotationId: 1,
      codeNumber: 12,
      volumeLetters: "A",
    });
  });

  it.each([
    ["a digit", "1"],
    ["a slash", "a/b"],
    ["a space", "a b"],
    ["punctuation", "??"],
  ])("carries a volume letters value containing %s through, upper-cased", (_label, vol) => {
    expect(parseImportedReleaseParams("1", "12", vol)).toEqual({
      rotationId: 1,
      codeNumber: 12,
      volumeLetters: vol.toUpperCase(),
    });
  });

  it("drops the entire code -- not just the letters -- when volume letters overflow the column", () => {
    expect(parseImportedReleaseParams("1", "12", "abcde")).toEqual({
      rotationId: 1,
      codeNumber: undefined,
      volumeLetters: undefined,
    });
  });

  it("counts overflow in code points, matching the server", () => {
    // Four astral code points, eight UTF-16 units -- must not overflow.
    const fourAstral = "𝒜𝒷𝒸𝒹";
    expect(parseImportedReleaseParams("1", "12", fourAstral)).toEqual({
      rotationId: 1,
      codeNumber: 12,
      volumeLetters: fourAstral.toUpperCase(),
    });
  });

  it("leaves the code intact when vol is absent", () => {
    expect(parseImportedReleaseParams("1", "12", undefined)).toEqual({
      rotationId: 1,
      codeNumber: 12,
      volumeLetters: undefined,
    });
  });

  it("returns undefined when imported is not a positive integer", () => {
    expect(parseImportedReleaseParams("0", "12", "a")).toBeUndefined();
    expect(parseImportedReleaseParams("not-a-number", "12", "a")).toBeUndefined();
  });
});

describe("importedConfirmation", () => {
  it("names the shelf code and the rotation release when a code is given", () => {
    expect(importedConfirmation("Rock MO 12/7-A/B", 42)).toBe(
      "Filed as Rock MO 12/7-A/B, and linked to rotation release #42.",
    );
  });

  it("omits the code clause entirely, rather than asserting a partial one, when no code is given", () => {
    expect(importedConfirmation(null, 42)).toBe(
      "Catalogued and linked to rotation release #42.",
    );
  });
});
