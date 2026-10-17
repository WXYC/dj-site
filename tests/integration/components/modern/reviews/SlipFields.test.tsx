import { describe, expect, it } from "vitest";
import { FIELD_NAMES } from "@/lib/features/reviews/draftKeys";
import { toFieldPatch, toFieldValues } from "@/src/components/experiences/modern/reviews/SlipFields";

const values = { buzzwords: "", review: "Warm and loose.", recommended_tracks: " la paradoja ", fcc: "\t" };

describe("toFieldPatch", () => {
  it.each([
    ["buzzwords", null],
    ["review", "Warm and loose."],
    ["recommended_tracks", " la paradoja "],
    ["fcc", null],
  ] as const)("sends %s as %j", (name, expected) => {
    expect(toFieldPatch(values)[name]).toBe(expected);
  });
});

describe("the slip's fields", () => {
  it("leave out the artist paragraph", () => {
    expect(FIELD_NAMES).not.toContain("artist_blurb");
    expect(Object.keys(toFieldPatch(values))).not.toContain("artist_blurb");
  });
});

describe("toFieldValues", () => {
  it("starts null fields as empty strings", () => {
    const start = toFieldValues({ buzzwords: null, review: null, recommended_tracks: null, fcc: null } as never);
    expect(Object.keys(start)).toEqual([...FIELD_NAMES]);
    expect(start).toMatchObject({ buzzwords: "", review: "" });
  });
});
