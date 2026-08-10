import { describe, it, expect } from "vitest";

import {
  isVariousArtistsEntry,
  releaseCreditIsRefused,
  seedableArtistName,
} from "@/lib/features/flowsheet/various-artists-guard";

describe("isVariousArtistsEntry", () => {
  it.each([
    "Various Artists",
    "various artists",
    "VARIOUS ARTISTS",
    "Various Artist",
    "Various",
    "  Various   Artists  ",
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
  ])("refuses the compilation designation %s", (input) => {
    expect(isVariousArtistsEntry(input)).toBe(true);
  });

  // The two spellings the shared release-artist predicate deliberately allows.
  // In the artist field of a flowsheet entry they are only ever shorthand for
  // the compilation credit, and tubafrenzy has refused both for years.
  it.each(["VA", "va", "V A", "v a", "Var. Artists", "Var Artists", "var. artist"])(
    "refuses the abbreviated compilation credit %s",
    (input) => {
      expect(isVariousArtistsEntry(input)).toBe(true);
    }
  );

  it.each([
    "Juana Molina",
    "Stereolab",
    "Cat Power",
    "Jessica Pratt",
    "Chuquimamani-Condori",
    "Duke Ellington & John Coltrane",
    "Nilüfer Yanya",
    // Real artists whose names embed a keyword — the whole-name anchoring is
    // what keeps these submittable.
    "Various Production",
    "The Soundtrack of Our Lives",
    "Death By Compilation",
    "Vamping In Vegas",
    "Variant Configuration",
    // "Van" and "Vast" start with the same two letters as the "v...a" arm
    // without being an abbreviation of it.
    "Van Morrison",
    "Vashti Bunyan",
  ])("allows the performing artist %s", (input) => {
    expect(isVariousArtistsEntry(input)).toBe(false);
  });

  it.each([null, undefined, "", "   "])(
    "allows empty input %s — emptiness is a separate check",
    (input) => {
      expect(isVariousArtistsEntry(input)).toBe(false);
    }
  );
});

describe("releaseCreditIsRefused", () => {
  // This is what drives the rotation artist field and the freeform routing.
  // Keying either on `isCompilationRelease` instead leaves a hole in both
  // directions, so the divergent cases are pinned here.
  it.each(["Various Artists", "V/A", "VA", "Var. Artists", "Soundtrack"])(
    "is true for a release credited %s",
    (name) => {
      expect(releaseCreditIsRefused({ artist: { name } })).toBe(true);
    }
  );

  it("is false for a compilation filed under a credited album artist", () => {
    // An isCompilationRelease whose name the guard never refuses: it is
    // submittable as-is and must keep its library linkage.
    expect(
      releaseCreditIsRefused({ artist: { name: "Kruder & Dorfmeister" } })
    ).toBe(false);
  });

  it.each([null, { artist: null }, { artist: { name: null } }])(
    "is false for a release with no credit (%s)",
    (release) => {
      expect(releaseCreditIsRefused(release)).toBe(false);
    }
  );
});

describe("seedableArtistName", () => {
  it("passes through a performing artist", () => {
    expect(seedableArtistName({ artist: { name: "Jessica Pratt" } })).toBe(
      "Jessica Pratt"
    );
  });

  it.each(["Various Artists", "VA", "Var. Artists"])(
    "blanks the refused credit %s rather than seeding it",
    (name) => {
      expect(seedableArtistName({ artist: { name } })).toBe("");
    }
  );

  it("returns an empty string for a null-artist release", () => {
    expect(seedableArtistName({ artist: null })).toBe("");
  });
});
