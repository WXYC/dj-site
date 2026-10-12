import type { Review } from "@wxyc/shared";

/**
 * The one rule for whether a review has an author, where it applies: the From line, the Delete review button's spoken name, and that button's confirmation question. A null, empty or whitespace-only author is "no author" at those sites, so they never disagree.
 * Returns the trimmed name, or null when there is none. Other places that read the author (for example the record-delete dialog) do not use it. Names are real names: station display only, never telemetry.
 */
export function namedAuthor(review: Pick<Review, "author">): string | null {
  return review.author?.trim() || null;
}
