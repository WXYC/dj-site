import { describe, it, expect } from "vitest";

import { isVariousArtistsEntry } from "@/lib/features/flowsheet/various-artists-guard";

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
