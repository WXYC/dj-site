import { describe, it, expect } from "vitest";

import {
  isCompilationArtistName,
  isCompilationReleaseArtistName,
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

describe("isCompilationReleaseArtistName", () => {
  it.each([
    "Various Artists",
    "various artists",
    "VARIOUS ARTISTS",
    "Various Artist",
    "Various",
    "  Various   Artists  ", // extra/collapsed whitespace still matches
    "V/A",
    "v/a",
    "V / A",
    "V.A.",
    "v.a.",
    "Soundtrack",
    "Original Soundtrack",
    "Original Motion Picture Soundtrack",
    "OST",
    "Compilation",
  ])("returns true for genuine compilation designation %s", (input) => {
    expect(isCompilationReleaseArtistName(input)).toBe(true);
  });

  it.each([
    "The Soundtrack of Our Lives",
    "Various Production",
    "Various Production, Inc.",
    "Soundtrack of My Life",
    "Death By Compilation",
    "The Compilation Kids",
    "Saint Etienne",
    "Juana Molina",
    "Stereolab",
    "VA",
  ])("returns false for keyword-substring single artist %s", (input) => {
    expect(isCompilationReleaseArtistName(input)).toBe(false);
  });

  it.each([null, undefined, ""])(
    "returns false for empty input %s",
    (input) => {
      expect(isCompilationReleaseArtistName(input)).toBe(false);
    }
  );
});

describe("isCompilationRelease", () => {
  it.each([
    "The Soundtrack of Our Lives",
    "Various Production",
  ])(
    "returns false for keyword-substring single artist %s (no album_artist)",
    (name) => {
      expect(isCompilationRelease({ artist: { name } })).toBe(false);
    }
  );

  // BS#2004: `album_artist` became a librarian-written credit that can sit on
  // a release filed under a named artist, so it no longer implies a
  // compilation. The shelf decides.
  it("returns false for a named-artist release even when album_artist is populated (BS#2004)", () => {
    expect(
      isCompilationRelease({
        album_artist: "Kruder & Dorfmeister",
        artist: { name: "Stereolab", lettercode: "ST" },
      } as Parameters<typeof isCompilationRelease>[0]),
    ).toBe(false);
  });

  it.each(["V/A", "v/a", " V/A ", "Z--", "Z-A"])(
    "returns true for a release on the V/A shelf by call letters %s, whatever the name",
    (lettercode) => {
      expect(
        isCompilationRelease({ artist: { name: "Soundtracks - L", lettercode } }),
      ).toBe(true);
    },
  );

  it("does not treat a non-V/A lettercode as a compilation", () => {
    expect(isCompilationRelease({ artist: { name: "Stereolab", lettercode: "ST" } })).toBe(false);
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

});
