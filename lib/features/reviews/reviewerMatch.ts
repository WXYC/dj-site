import type { Reviewer } from "@wxyc/shared";
import { foldForSearch } from "@/lib/features/admin/roster-filter";

/** How many names the Ask a DJ search lists before it counts the rest. */
export const MATCH_LIMIT = 8;

export interface ReviewerMatches {
  shown: Reviewer[];
  /** How many more names match than `shown` lists. */
  more: number;
}

/**
 * The accounts whose name matches what a music director has typed, in the order given.
 *
 * A name matches when any of its words starts with the query, ignoring case and accents. Only when no name does, the query may sit anywhere in a name: a word start is what a person means by a few letters, and letting the loose match in beside it would bury "Pat" under every "Spatial".
 */
export function matchReviewers(reviewers: Reviewer[], query: string): ReviewerMatches {
  const needle = foldForSearch(query).trim().replace(/\s+/g, " ");
  const folded = reviewers.map((r) => ({ reviewer: r, name: ` ${foldForSearch(r.name)}` }));
  const wordStarts = folded.filter((f) => f.name.includes(` ${needle}`));
  const matches = wordStarts.length > 0 ? wordStarts : folded.filter((f) => f.name.includes(needle));
  return {
    shown: matches.slice(0, MATCH_LIMIT).map((f) => f.reviewer),
    more: Math.max(0, matches.length - MATCH_LIMIT),
  };
}
