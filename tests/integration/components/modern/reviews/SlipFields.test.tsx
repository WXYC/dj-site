import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import { FIELD_NAMES } from "@/lib/features/reviews/draftKeys";
import SlipFields, { emptyFieldValues, toFieldPatch, toFieldValues } from "@/src/components/experiences/modern/reviews/SlipFields";

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

describe("toFieldPatch with a field list", () => {
  it("carries only the listed fields, so a field left out of the editor leaves the stored value alone", () => {
    expect(Object.keys(toFieldPatch(values, ["buzzwords", "review"]))).toEqual(["buzzwords", "review"]);
  });
});

describe("SlipFields", () => {
  it.each([
    ["every field by default", undefined, [...FIELD_NAMES]],
    ["only the fields it is given", ["review", "buzzwords"] as const, ["buzzwords", "review"]],
  ])("draws %s", (_name, fields, drawn) => {
    render(<SlipFields values={emptyFieldValues()} onChange={vi.fn()} fields={fields} />);

    const labels = FIELD_NAMES.filter((n) => screen.queryByLabelText(REVIEW_COPY.fields[n].label));
    expect(labels).toEqual(drawn);
  });
});

describe("toFieldValues", () => {
  it("starts null fields as empty strings", () => {
    const start = toFieldValues({ buzzwords: null, review: null, recommended_tracks: null, fcc: null } as never);
    expect(Object.keys(start)).toEqual([...FIELD_NAMES]);
    expect(start).toMatchObject({ buzzwords: "", review: "" });
  });
});
