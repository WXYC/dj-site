import { describe, it, expect } from "vitest";
import { parseRequiredPositiveInt } from "@/lib/features/catalog/adminCreateArtistValidation";

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
