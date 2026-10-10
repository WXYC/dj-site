import type { Review, ReviewRevision } from "@wxyc/shared";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { useGetReviewRevisionsQuery } from "@/lib/features/reviews/reviewApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";

/**
 * `none`: nothing to say (not on this cover, never printed, or a print with no usable date).
 * `loading`: the revisions have not arrived, or there are none.
 */
export type PrintedVersion = "none" | "loading" | "failed" | "current" | "edited";

/**
 * Whether the review on a cover was printed and has been edited since. The one
 * place the rule lives, so the version note and the print link cannot disagree.
 * Reads the revisions only for a review that is on this cover (`onCover`, which
 * each surface decides from the signal it has) and was printed. "Edited" is
 * decided from the revisions, never from `last_modified`: a consent change
 * moves that without writing a version.
 */
export function usePrintedVersion(review: Review | undefined, { onCover }: { onCover: boolean }): PrintedVersion {
  const visible = useCanSeeReviews();
  const printed = onCover && review?.printed_revision_id != null;
  const revisions = useGetReviewRevisionsQuery(review?.id ?? 0, { skip: !visible || !printed });

  if (!visible || !printed) return "none";
  if (hasNothingToShow(revisions)) return "failed";
  const newest = revisions.data?.reduce<ReviewRevision | undefined>((a, b) => (a && a.revision >= b.revision ? a : b), undefined);
  if (!newest) return "loading";
  if (newest.id === review.printed_revision_id) return "current";
  // A print with no usable date cannot say when the cover was printed.
  if (!review.printed_at || Number.isNaN(Date.parse(review.printed_at))) return "none";
  return "edited";
}
