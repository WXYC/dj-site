import { describe, it, expect } from "vitest";

import {
  isCompilationArtistName,
  isCompilationRelease,
} from "@/lib/features/catalog/is-compilation-artist";

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

describe("isCompilationRelease", () => {
  it("returns true when album_artist is populated, regardless of artist name", () => {
    expect(
      isCompilationRelease({
        album_artist: "Kruder & Dorfmeister",
        artist: { name: "Kruder & Dorfmeister" },
      })
    ).toBe(true);
  });

  it("returns true for a V/A-shaped artist name without album_artist", () => {
    expect(isCompilationRelease({ artist: { name: "Various Artists" } })).toBe(
      true
    );
  });

  it("returns false for a normal release", () => {
    expect(isCompilationRelease({ artist: { name: "Stereolab" } })).toBe(false);
  });

  it("returns false when artist is null and album_artist absent", () => {
    expect(isCompilationRelease({ artist: null })).toBe(false);
  });

  it("returns false for an empty album_artist string", () => {
    expect(
      isCompilationRelease({ album_artist: "", artist: { name: "Cat Power" } })
    ).toBe(false);
  });
});
