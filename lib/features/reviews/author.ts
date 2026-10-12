import type { Review } from "@wxyc/shared";

/**
 * The one rule for whether a review has an author. A null, empty or whitespace-only author is "no author"
 * everywhere a review is shown, so the From line, the Delete review button and its question never disagree.
 * Returns the trimmed name, or null when there is none. Names are real names: station display only,
 * never telemetry.
 */
export function namedAuthor(review: Pick<Review, "author">): string | null {
  return review.author?.trim() || null;
}
