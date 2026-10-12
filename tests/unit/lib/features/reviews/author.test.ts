import { describe, it, expect } from "vitest";
import { namedAuthor } from "@/lib/features/reviews/author";

describe("namedAuthor", () => {
  it.each<[string, string | null, string | null]>([
    ["null", null, null],
    ["empty", "", null],
    ["whitespace only", "  ", null],
    ["a name with surrounding space", " DJ Sam ", "DJ Sam"],
    ["a plain name", "DJ Sam", "DJ Sam"],
  ])("reads a %s author as %j", (_label, author, expected) => {
    expect(namedAuthor({ author })).toBe(expected);
  });
});
