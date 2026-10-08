import { describe, expect, it } from "vitest";
import { FIELD_NAMES, toFieldPatch, toFieldValues } from "@/src/components/experiences/modern/reviews/SlipFields";

const values = { buzzwords: "", artist_blurb: "  \n ", review: "Warm and loose.", recommended_tracks: " la paradoja ", fcc: "\t" };

describe("toFieldPatch", () => {
  it.each([
    ["buzzwords", null],
    ["artist_blurb", null],
    ["review", "Warm and loose."],
    ["recommended_tracks", " la paradoja "],
    ["fcc", null],
  ] as const)("sends %s as %j", (name, expected) => {
    expect(toFieldPatch(values)[name]).toBe(expected);
  });
});

describe("toFieldValues", () => {
  it("starts null fields as empty strings", () => {
    const start = toFieldValues({ buzzwords: null, artist_blurb: "x", review: null, recommended_tracks: null, fcc: null } as never);
    expect(Object.keys(start)).toEqual([...FIELD_NAMES]);
    expect(start).toMatchObject({ buzzwords: "", artist_blurb: "x", review: "" });
  });
});
