import type { Reviewer } from "@wxyc/shared";
import { foldForSearch } from "@/lib/features/admin/roster-filter";

/** How many names the Ask a DJ search lists before it counts the rest. */
export const MATCH_LIMIT = 8;

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
}

/** Folds case and accents, and reads a hyphen, an apostrophe or a run of spaces as one space between words. */
const words = (value: string) => foldForSearch(value).replace(/[\s'’-]+/g, " ").trim();

/** Folds each reviewer's name once; pass the result to `matchReviewers` for every query. */
export function foldReviewers(reviewers: Reviewer[]): FoldedReviewer[] {
  return reviewers.map((r) => ({ reviewer: r, name: ` ${words(r.name)}` }));
}

/**
 * The accounts whose name matches what a music director has typed, in the order given.
 *
 * A name matches when any of its words starts with the query, ignoring case and accents; a hyphen or an apostrophe starts a word as a space does. Only when no name does, the query may sit anywhere in a name: a word start is what a person means by a few letters, and letting the loose match in beside it would bury "Pat" under every "Spatial".
 */
export function matchReviewers(folded: FoldedReviewer[], query: string): ReviewerMatches {
  const needle = words(query);
  const wordStarts = folded.filter((f) => f.name.includes(` ${needle}`));
  const matches = wordStarts.length > 0 ? wordStarts : folded.filter((f) => f.name.includes(needle));
  return {
    shown: matches.slice(0, MATCH_LIMIT).map((f) => f.reviewer),
    more: Math.max(0, matches.length - MATCH_LIMIT),
  };
}
