import { describe, it, expect } from "vitest";

import { isCompilationArtistName } from "@/lib/features/catalog/is-compilation-artist";

describe("isCompilationArtistName", () => {
  it.each([
    "Various Artists",
    "various artists",
    "VARIOUS ARTISTS",
    "Various",
    "V/A",
    "v/a",
    "V.A.",
    "v.a.",
    "Soundtrack",
    "Original Soundtrack",
    "Compilation",
    "Best Of Compilation 2025",
  ])("returns true for %s", (input) => {
    expect(isCompilationArtistName(input)).toBe(true);
  });

  it.each([
    "Juana Molina",
    "Stereolab",
    "Cat Power",
    "Chuquimamani-Condori",
    "Duke Ellington & John Coltrane",
    "Variant Configuration", // contains "var" but not "various"
    "Vamping In Vegas", // starts with "va" but not "v/a" or "various"
    "VA", // bare "VA" without separators
  ])("returns false for %s", (input) => {
    expect(isCompilationArtistName(input)).toBe(false);
  });

  it.each([null, undefined, ""])("returns false for empty input %s", (input) => {
    expect(isCompilationArtistName(input)).toBe(false);
  });
});
