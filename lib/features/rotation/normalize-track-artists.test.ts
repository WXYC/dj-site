import { describe, it, expect } from "vitest";
import { normalizeTrackArtists } from "./normalize-track-artists";

/**
 * Locks the per-track Discogs credit normalization behind BS#944 (multi-role /
 * duplicate / disambig-suffixed artist credits). This logic previously had no
 * dedicated unit test — its only coverage lived in a RotationEntryFields
 * component test that the v1 redesign orphaned. The v2 smart entry keeps
 * calling this helper (via RotationBrowse), so the invariants are pinned here
 * where they can't be lost to a component rewrite.
 */
describe("normalizeTrackArtists (#944)", () => {
  it("returns [] for null/undefined/empty input", () => {
    expect(normalizeTrackArtists(null)).toEqual([]);
    expect(normalizeTrackArtists(undefined)).toEqual([]);
    expect(normalizeTrackArtists([])).toEqual([]);
  });

  it("passes through a single clean credit", () => {
    expect(normalizeTrackArtists(["Skull Mitten"])).toEqual(["Skull Mitten"]);
  });

  it("preserves distinct multi-credit order", () => {
    expect(
      normalizeTrackArtists(["Skull Mitten", "Various Drummers"])
    ).toEqual(["Skull Mitten", "Various Drummers"]);
  });

  it("dedupes doubled credits, keeping first occurrence (Warrior, Warrior → Warrior)", () => {
    // The 2026-05-25 on-air report: Discogs multi-role on one person + LML
    // cache duplicate rows produce ["Warrior", "Warrior"].
    expect(normalizeTrackArtists(["Warrior", "Warrior"])).toEqual(["Warrior"]);
  });

  it("strips the Discogs ' (N)' disambiguation suffix", () => {
    expect(normalizeTrackArtists(["M.I.A. (2)"])).toEqual(["M.I.A."]);
    expect(normalizeTrackArtists(["Nation (12)"])).toEqual(["Nation"]);
  });

  it("dedupes across the disambig boundary (M.I.A. (2) + M.I.A. → one)", () => {
    expect(normalizeTrackArtists(["M.I.A. (2)", "M.I.A."])).toEqual(["M.I.A."]);
  });

  it("trims whitespace and drops empty/whitespace-only entries", () => {
    expect(normalizeTrackArtists(["  Warrior  ", "", "   "])).toEqual([
      "Warrior",
    ]);
  });

  it("is defensive against non-string entries in a malformed LML response", () => {
    expect(
      normalizeTrackArtists([
        "Skull Mitten",
        null,
        undefined,
        42,
        { name: "nope" },
      ] as unknown[])
    ).toEqual(["Skull Mitten"]);
  });
});
