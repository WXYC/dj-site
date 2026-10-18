import { describe, it, expect } from "vitest";
import type { Reviewer } from "@wxyc/shared";
import {
  describeReviewer,
  foldReviewers,
  matchReviewers as matchFolded,
  MATCH_LIMIT,
  SUGGESTION_LIMIT,
  suggestReviewers as suggestFolded,
} from "@/lib/features/reviews/reviewerMatch";

const named = (...names: string[]): Reviewer[] => names.map((name, i) => ({ id: `dj-${i}`, name }));
const namesOf = (rows: Reviewer[]) => rows.map((r) => r.name);
const matchReviewers = (reviewers: Reviewer[], query: string, passedIds?: ReadonlySet<string>) => matchFolded(foldReviewers(reviewers), query, passedIds);
const suggestReviewers = (reviewers: Reviewer[], passedIds?: ReadonlySet<string>) => suggestFolded(foldReviewers(reviewers), passedIds);
const reviewer = (id: string, extra: Partial<Reviewer> = {}): Reviewer => ({ id, name: `Test ${id}`, ...extra });
const DAY = (n: number) => `2026-10-${String(n).padStart(2, "0")}T12:00:00Z`;

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

describe("matchReviewers on-air names and passes", () => {
  const PAT = reviewer("a", { name: "Test Alpha", on_air_name: "DJ Patsy" });

  it.each([
    ["the start of an on-air word", "pat", ["Test Alpha"]],
    ["the start of a later on-air word", "dj p", ["Test Alpha"]],
    ["the real name still", "alp", ["Test Alpha"]],
  ])("finds on %s", (_label, query, expected) => {
    expect(namesOf(matchReviewers([PAT, reviewer("b")], query).shown)).toEqual(expected);
  });

  it("does not read the on-air name's middle as a word start", () => {
    expect(matchReviewers([PAT, reviewer("b", { name: "Atsy Beta" })], "atsy").shown.map((r) => r.id)).toEqual(["b"]);
  });

  it("lists a passer last, before the cut", () => {
    const many = Array.from({ length: MATCH_LIMIT + 2 }, (_, i) => reviewer(`p${i}`));
    const { shown, more } = matchReviewers(many, "test", new Set(["p0"]));
    expect(shown).toHaveLength(MATCH_LIMIT);
    expect(shown.map((r) => r.id)).not.toContain("p0");
    expect(more).toBe(2);
    expect(matchReviewers(many.slice(0, 3), "test", new Set(["p0"])).shown.map((r) => r.id)).toEqual(["p1", "p2", "p0"]);
  });
});

describe("suggestReviewers", () => {
  it.each([
    ["recent and free", { last_submitted_at: DAY(5), records_out: 0 }, true],
    ["recent with a record out", { last_submitted_at: DAY(5), records_out: 1 }, false],
    ["never submitted", { last_submitted_at: null, records_out: 0 }, false],
    ["no submission field", { records_out: 0 }, false],
    ["no records-out field", { last_submitted_at: DAY(5) }, false],
  ])("%s: in is %s", (_label, extra, isIn) => {
    expect(suggestReviewers([reviewer("a", extra)]).map((r) => r.id)).toEqual(isIn ? ["a"] : []);
  });

  it("keeps the newest few, newest first", () => {
    const people = Array.from({ length: SUGGESTION_LIMIT + 2 }, (_, i) => reviewer(`r${i}`, { last_submitted_at: DAY(i + 1), records_out: 0 }));
    expect(suggestReviewers(people).map((r) => r.id)).toEqual(["r6", "r5", "r4", "r3", "r2"]);
  });

  it("demotes a passer to last", () => {
    const people = [1, 2, 3].map((n) => reviewer(`r${n}`, { last_submitted_at: DAY(n), records_out: 0 }));
    expect(suggestReviewers(people, new Set(["r3"])).map((r) => r.id)).toEqual(["r2", "r1", "r3"]);
  });
});

describe("describeReviewer", () => {
  it.each([
    ["no on-air name", reviewer("a"), false, []],
    ["an on-air name equal to the name", reviewer("a", { on_air_name: "Test a" }), false, []],
    ["a different on-air name", reviewer("a", { on_air_name: "DJ Sample" }), false, ["On air as DJ Sample."]],
    ["no records out", reviewer("a", { records_out: 0 }), false, ["Nothing out."]],
    ["one record out", reviewer("a", { records_out: 1 }), false, ["1 record out."]],
    ["three records out", reviewer("a", { records_out: 3 }), false, ["3 records out."]],
    ["a passer", reviewer("a"), true, ["Passed on this record."]],
    ["all of it", reviewer("a", { on_air_name: "DJ Sample", records_out: 3 }), true, ["On air as DJ Sample.", "3 records out.", "Passed on this record."]],
  ])("says %s", (_label, who, passed, lines) => {
    expect(describeReviewer(who, passed)).toEqual(lines);
  });
});
