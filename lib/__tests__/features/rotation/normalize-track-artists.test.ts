import { describe, expect, it } from "vitest";
import { normalizeTrackArtists } from "@/lib/features/rotation/normalize-track-artists";

describe("normalizeTrackArtists", () => {
  it.each<[unknown[] | null | undefined, string[]]>([
    // Same artist returned twice — the on-disk dupe pattern (LML release_track_artist
    // has 6,973 such rows across 144 prod releases as of 2026-05-25) plus the
    // Discogs same-name multi-role pattern ("Producer" + "Co-writer" on one track).
    [["Warrior", "Warrior"], ["Warrior"]],
    [["Miss Shiva", "Miss Shiva"], ["Miss Shiva"]],
    [["Warrior", "Warrior", "Warrior"], ["Warrior"]],

    // Discogs `(N)` disambig suffix is stripped before dedupe so "M.I.A. (2)" and
    // "M.I.A. (2)" collapse, and so the suffix doesn't leak into the artist field.
    [["M.I.A. (2)"], ["M.I.A."]],
    [["M.I.A. (2)", "M.I.A. (2)"], ["M.I.A."]],
    [["Dry Cleaning (2)", "Dry Cleaning"], ["Dry Cleaning"]],

    // Whitespace differences collapse after trim.
    [["Miss Shiva ", " Miss Shiva", "Miss Shiva"], ["Miss Shiva"]],

    // Genuine multi-credit cases preserve order and both names.
    [["Florence Shaw", "Tom Dowse"], ["Florence Shaw", "Tom Dowse"]],
    [["Stereolab", "Nurse With Wound"], ["Stereolab", "Nurse With Wound"]],

    // Empty / missing inputs degrade to empty array without throwing.
    [[], []],
    [null, []],
    [undefined, []],
    [["", "  ", "\t"], []],
    [["", "Real Artist", ""], ["Real Artist"]],

    // Defensive against malformed shapes from a partial-write LML row.
    [[null as unknown as string, "Real"], ["Real"]],
    [[undefined as unknown as string, "Real"], ["Real"]],
    [[42 as unknown as string, "Real"], ["Real"]],
    [[{} as unknown as string, "Real"], ["Real"]],
  ])("normalizes %j → %j", (input, expected) => {
    expect(normalizeTrackArtists(input)).toEqual(expected);
  });

  it("preserves first-occurrence order when duplicates are interleaved", () => {
    expect(normalizeTrackArtists(["A", "B", "A", "C", "B"])).toEqual(["A", "B", "C"]);
  });

  it("returns a fresh array on every call (no shared mutable state)", () => {
    const first = normalizeTrackArtists(["X"]);
    const second = normalizeTrackArtists(["X"]);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
