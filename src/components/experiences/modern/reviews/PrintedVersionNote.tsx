"use client";

import Link from "next/link";
import { Link as JoyLink, Stack, Typography } from "@mui/joy";
import type { Review } from "@wxyc/shared";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { useGetReviewRevisionsQuery } from "@/lib/features/reviews/reviewApi";
import { formatStationLongDate } from "@/src/utilities/stationTime";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { REVIEW_COPY } from "./copy";

const copy = REVIEW_COPY.printedNote;

/**
 * Says whether the text shown is the version taped to the cover. Reads the
 * revisions only for a review that was printed. Whether it changed since is
 * decided from the revisions, never from `last_modified`: a consent change moves
 * that without writing a version.
 */
export default function PrintedVersionNote({ review, newSlipHref }: { review: Review; newSlipHref?: string }) {
  const visible = useCanSeeReviews();
  const printed = review.printed_revision_id != null;
  const revisions = useGetReviewRevisionsQuery(review.id, { skip: !visible || !printed });

  if (!visible || !printed) return null;
  if (hasNothingToShow(revisions)) return <Typography level="body-sm" role="alert">{copy.loadFailed}</Typography>;
  const newest = revisions.data?.reduce((a, b) => (b.revision > a.revision ? b : a));
  if (!newest) return null;

  if (newest.id === review.printed_revision_id) return <Typography level="body-sm">{copy.isCurrent}</Typography>;
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Typography level="body-sm">{copy.edited(formatStationLongDate(review.printed_at ?? ""))}</Typography>
      <JoyLink component={Link} href={`/dashboard/reviews/${review.id}/history#printed`} level="body-sm">
        {copy.seePrinted}
      </JoyLink>
      {newSlipHref && (
        <JoyLink component={Link} href={newSlipHref} level="body-sm">{copy.printNew}</JoyLink>
      )}
    </Stack>
  );
}
