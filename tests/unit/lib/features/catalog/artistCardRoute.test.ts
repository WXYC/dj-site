import { describe, it, expect } from "vitest";

import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";

describe("artistCardHref", () => {
  it.each([
    ["Various Artists", "V/A"],
    ["Various Artists - Rock - A", "V/A"],
    ["Soundtracks - L", "V/A"],
    // The legacy spelling, for a row that predates or bypassed the catalog
    // import's rewrite.
    ["Various Artists - Rock - B", "Z-B"],
  ])("sends the compilation shelf row %j, filed under %j, to the bucket card", (
    _artistName,
    code_letters,
  ) => {
    expect(artistCardHref({ id: 4211, code_letters })).toBe(
      "/dashboard/library/various/4211",
    );
  });

  it.each([
    ["Juana Molina", "MOLI"],
    ["Stereolab", "STER"],
    // Keyword in the name, filed as an ordinary artist: the name must not
    // pull it onto the compilation shelf.
    ["The Soundtrack of Our Lives", "SOUN"],
    ["Various Production", "VARI"],
  ])("sends the ordinary artist %j, filed under %j, to the artist card", (
    _artistName,
    code_letters,
  ) => {
    expect(artistCardHref({ id: 4211, code_letters })).toBe(
      "/dashboard/library/artist/4211",
    );
  });
});
