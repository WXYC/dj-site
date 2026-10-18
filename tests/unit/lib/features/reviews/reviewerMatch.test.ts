import { describe, it, expect } from "vitest";
import type { Reviewer } from "@wxyc/shared";
import { foldReviewers, matchReviewers as matchFolded, MATCH_LIMIT } from "@/lib/features/reviews/reviewerMatch";

const named = (...names: string[]): Reviewer[] => names.map((name, i) => ({ id: `dj-${i}`, name }));
const namesOf = (rows: Reviewer[]) => rows.map((r) => r.name);
const matchReviewers = (reviewers: Reviewer[], query: string) => matchFolded(foldReviewers(reviewers), query);

const ROSTER = named("Nilüfer Test", "Pat Placeholder", "Test Juana", "Test Reviewer", "Juniper Sample");
// Names whose words are split by something other than one space, each beside a name that starts with the same word, which keeps the anywhere-in-the-name fallback from finding it instead.
const BOUNDARIES = named("Anne-Kate Sample", "Kate Test", "Test O'Reilly", "Reilly Test", "Test D’Arcy", "Arcy Sample", "Spacey  Test");

describe("matchReviewers", () => {
  it.each([
    ["the start of any word", "ju", ["Test Juana", "Juniper Sample"]],
    ["the start of the first word", "pat", ["Pat Placeholder"]],
    ["a word start across words", "test r", ["Test Reviewer"]],
    ["case", "PAT", ["Pat Placeholder"]],
    ["an accented letter typed without its accent", "nil", ["Nilüfer Test"]],
    ["an accent typed against an unaccented name", "pät", ["Pat Placeholder"]],
    ["surrounding spaces", "  pat  ", ["Pat Placeholder"]],
    ["the word after a hyphen", "kate", ["Anne-Kate Sample", "Kate Test"]],
    ["a hyphen typed as in the name", "anne-kate", ["Anne-Kate Sample"]],
    ["a hyphen typed as a space", "anne kate", ["Anne-Kate Sample"]],
    ["the word after an apostrophe", "reilly", ["Test O'Reilly", "Reilly Test"]],
    ["the word after a curly apostrophe", "arcy", ["Test D’Arcy", "Arcy Sample"]],
    ["a name with a run of spaces", "spacey t", ["Spacey  Test"]],
  ])("finds on %s", (_label, query, expected) => {
    const { shown, more } = matchReviewers([...ROSTER, ...BOUNDARIES], query);
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
