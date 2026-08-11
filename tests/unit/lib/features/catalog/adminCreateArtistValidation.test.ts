import { describe, it, expect } from "vitest";
import {
  isArtistNameConflictData,
  parseRequiredPositiveInt,
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
