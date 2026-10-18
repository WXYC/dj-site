import type { Reviewer } from "@wxyc/shared";
import { foldForSearch } from "@/lib/features/admin/roster-filter";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

/** How many names the Ask a DJ search lists before it counts the rest. */
export const MATCH_LIMIT = 8;

/** How many people the Ask a DJ search suggests before anyone types. */
export const SUGGESTION_LIMIT = 5;

export interface ReviewerMatches {
  shown: Reviewer[];
  /** How many more names match than `shown` lists. */
  more: number;
}

/** A reviewer with its name folded once for matching, so a keystroke refolds nothing. */
export interface FoldedReviewer {
  reviewer: Reviewer;
  /** The folded name with a leading space, so every word starts after a space. */
  name: string;
  /** The folded on-air name, led the same way; empty when there is none. */
  onAir: string;
}

/** Folds case and accents, and reads a hyphen, an apostrophe or a run of spaces as one space between words. */
const words = (value: string) => foldForSearch(value).replace(/[\s'’-]+/g, " ").trim();

/** Folds each reviewer's name once; pass the result to `matchReviewers` for every query. */
export function foldReviewers(reviewers: Reviewer[]): FoldedReviewer[] {
  return reviewers.map((r) => ({ reviewer: r, name: ` ${words(r.name)}`, onAir: r.on_air_name ? ` ${words(r.on_air_name)}` : "" }));
}

/** Stable: a passer moves behind everyone who has not passed, and nobody else moves. */
const passersLast = (list: FoldedReviewer[], passedIds: ReadonlySet<string>) =>
  [...list.filter((f) => !passedIds.has(f.reviewer.id)), ...list.filter((f) => passedIds.has(f.reviewer.id))];

/**
 * The accounts whose name or on-air name matches what a music director has typed, in the order given, except that anyone who already passed on the record comes last.
 *
 * A name matches when any of its words starts with the query, ignoring case and accents; a hyphen or an apostrophe starts a word as a space does. Only when no name does, the query may sit anywhere in a name: a word start is what a person means by a few letters, and letting the loose match in beside it would bury "Pat" under every "Spatial".
 */
export function matchReviewers(folded: FoldedReviewer[], query: string, passedIds: ReadonlySet<string> = new Set()): ReviewerMatches {
  const needle = words(query);
  const hits = (test: (field: string) => boolean) => folded.filter((f) => test(f.name) || (f.onAir !== "" && test(f.onAir)));
  const wordStarts = hits((field) => field.includes(` ${needle}`));
  const matches = passersLast(wordStarts.length > 0 ? wordStarts : hits((field) => field.includes(needle)), passedIds);
  return {
    shown: matches.slice(0, MATCH_LIMIT).map((f) => f.reviewer),
    more: Math.max(0, matches.length - MATCH_LIMIT),
  };
}

/** Up to five people who submitted a review recently and have nothing out now, newest first, with anyone who already passed on the record last. */
export function suggestReviewers(folded: FoldedReviewer[], passedIds: ReadonlySet<string> = new Set()): Reviewer[] {
  const recent = folded
    .filter(({ reviewer: r }) => r.last_submitted_at != null && r.records_out === 0)
    .sort((a, b) => Date.parse(b.reviewer.last_submitted_at!) - Date.parse(a.reviewer.last_submitted_at!));
  return passersLast(recent, passedIds)
    .slice(0, SUGGESTION_LIMIT)
    .map((f) => f.reviewer);
}

/**
 * The on-air name, trimmed, when it tells the person apart from the name; null when there is none or it reads as the name.
 *
 * The one rule for both a result row and the confirmation: the names are compared as the search reads them, so a handle that differs only by case, accents or spacing is not named twice.
 */
export function distinctOnAir(reviewer: Reviewer): string | null {
  const onAir = reviewer.on_air_name?.trim();
  if (!onAir || words(onAir) === words(reviewer.name)) {
    return null;
  }
  return onAir;
}

/** The lines a result row draws under the name; none for a person with nothing to tell apart. */
export function describeReviewer(reviewer: Reviewer, passed: boolean): string[] {
  const { onAirAs, recordsOut, passedOnThis } = REVIEW_COPY.intake;
  const onAir = distinctOnAir(reviewer);
  return [
    onAir ? onAirAs(onAir) : null,
    reviewer.records_out === undefined ? null : recordsOut(reviewer.records_out),
    passed ? passedOnThis : null,
  ].filter((line) => line !== null);
}
