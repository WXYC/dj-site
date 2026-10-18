import { describe, it, expect } from "vitest";
import type { Reviewer } from "@wxyc/shared";
import { matchReviewers, MATCH_LIMIT } from "@/lib/features/reviews/reviewerMatch";

const named = (...names: string[]): Reviewer[] => names.map((name, i) => ({ id: `dj-${i}`, name }));
const namesOf = (rows: Reviewer[]) => rows.map((r) => r.name);

const ROSTER = named("Nilüfer Test", "Pat Placeholder", "Test Juana", "Test Reviewer", "Juniper Sample");

describe("matchReviewers", () => {
  it.each([
    ["the start of any word", "ju", ["Test Juana", "Juniper Sample"]],
    ["the start of the first word", "pat", ["Pat Placeholder"]],
    ["a word start across words", "test r", ["Test Reviewer"]],
    ["case", "PAT", ["Pat Placeholder"]],
    ["an accented letter typed without its accent", "nil", ["Nilüfer Test"]],
    ["an accent typed against an unaccented name", "pät", ["Pat Placeholder"]],
    ["surrounding spaces", "  pat  ", ["Pat Placeholder"]],
  ])("finds on %s", (_label, query, expected) => {
    const { shown, more } = matchReviewers(ROSTER, query);
    expect(namesOf(shown)).toEqual(expected);
    expect(more).toBe(0);
  });

  it("falls back to anywhere in the name when no word starts with the query", () => {
    expect(namesOf(matchReviewers(ROSTER, "uana").shown)).toEqual(["Test Juana"]);
    // "est" starts no word, and sits inside "Test" in three names.
    expect(namesOf(matchReviewers(ROSTER, "est").shown)).toEqual(["Nilüfer Test", "Test Juana", "Test Reviewer"]);
  });

  it("does not fall back while a word start matches", () => {
    // "te" also sits inside "Latte", which the fallback would add.
    expect(namesOf(matchReviewers(named("Pat Test", "Latte Sample"), "te").shown)).toEqual(["Pat Test"]);
  });

  it("finds nothing when the query is nowhere in any name", () => {
    expect(matchReviewers(ROSTER, "zzz")).toEqual({ shown: [], more: 0 });
  });

  it("lists everyone, in the order given, for an empty query", () => {
    expect(matchReviewers(ROSTER, "").shown).toEqual(ROSTER);
    expect(matchReviewers(ROSTER, "   ").shown).toEqual(ROSTER);
  });

  it.each([
    ["exactly the cap", MATCH_LIMIT, 0],
    ["one past the cap", MATCH_LIMIT + 1, 1],
    ["hundreds of matches", 300, 300 - MATCH_LIMIT],
  ])("shows at most %s names and counts the rest", (_label, total, more) => {
    const many = named(...Array.from({ length: total }, (_, i) => `Test Person ${String(i).padStart(3, "0")}`));
    const result = matchReviewers(many, "per");
    expect(result.shown).toEqual(many.slice(0, MATCH_LIMIT));
    expect(result.more).toBe(more);
  });

  it("caps at eight", () => {
    expect(MATCH_LIMIT).toBe(8);
  });
});
