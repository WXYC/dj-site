"use client";

import Link from "next/link";
import { Button, Link as JoyLink, Stack, Typography } from "@mui/joy";
import type { Review } from "@wxyc/shared";
import { useGetReviewsForReleaseQuery } from "@/lib/features/reviews/reviewApi";
import { useGetAlbumReviewsForReleaseQuery } from "@/lib/features/reviews/albumReviewApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { REVIEW_COPY } from "./copy";
import PrintedVersionNote from "./PrintedVersionNote";
import SlipPreview, { SlipFccRow } from "./SlipPreview";

const { albumPanel: copy } = REVIEW_COPY;

type PanelRecord = { artist: string; album: string; label: string };

/** Named empty region the album's FCC notes are rendered into. */
export function FccNotesSlot({ albumId }: { albumId: number }) {
  return <div data-testid="fcc-notes-slot" data-album-id={albumId} />;
}

/** A review as the page shows it; `record` is set only when the review is about this page's own record. */
export function ReviewItem({ review, record, newSlipHref }: { review: Review; record?: PanelRecord; newSlipHref?: string }) {
  const onTheSleeve = review.medium === "handwritten" && !review.review;
  return (
    <Stack spacing={0.5} component="li" sx={{ listStyle: "none" }}>
      <PrintedVersionNote review={review} newSlipHref={newSlipHref} />
      {onTheSleeve ? (
        <>
          <Typography level="body-sm">
            {review.author} · {copy.onTheSleeve}
          </Typography>
          {review.fcc && <SlipFccRow fcc={review.fcc} />}
        </>
      ) : (
        <SlipPreview {...record} reviewer={review.author ?? ""} date={review.add_date} fields={review} />
      )}
      {review.revision_count > 1 && (
        <JoyLink component={Link} href={`/dashboard/reviews/${review.id}/history`} level="body-xs">
          {copy.history}
        </JoyLink>
      )}
    </Stack>
  );
}

/** A headed list of reviews; `recordOf` names the record a review is about, or nothing for a review of a release this record cites. */
export function Group({ title, reviews, recordOf, newSlipHref }: { title: string; reviews: Review[]; recordOf: (review: Review) => PanelRecord | undefined; newSlipHref?: string }) {
  return (
    <Stack component="section" spacing={1}>
      <Typography level="title-sm" component="h3">{title}</Typography>
      <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }}>
        {reviews.map((review) => (
          <ReviewItem key={review.id} review={review} record={recordOf(review)} newSlipHref={newSlipHref} />
        ))}
      </Stack>
    </Stack>
  );
}

/** The reviews of one library release, in the order the server returns them. */
export default function ReviewsPanel({ albumId, record }: { albumId: number; record: PanelRecord }) {
  const visible = useCanSeeReviews();
  const reviews = useGetReviewsForReleaseQuery(albumId, { skip: !visible });
  const archive = useGetAlbumReviewsForReleaseQuery(albumId, { skip: !visible });

  if (!visible) return null;

  const recordOf = (review: Review) => (review.album_id === albumId ? record : undefined);
  const onCover = reviews.data?.filter((r) => r.on_cover) ?? [];
  const rest = reviews.data?.filter((r) => !r.on_cover) ?? [];

  return (
    <Stack spacing={1.5} sx={{ my: 1 }}>
      <FccNotesSlot albumId={albumId} />
      {reviews.isError && <Typography role="alert">{copy.loadFailed}</Typography>}
      {onCover.length > 0 && (
        <Group title={onCover.length > 1 ? copy.coverMany : copy.coverOne} reviews={onCover} recordOf={recordOf} />
      )}
      {rest.length > 0 && (
        <Group title={onCover.length > 0 ? copy.others : copy.all} reviews={rest} recordOf={recordOf} />
      )}
      {!!archive.data?.length && (
        <Stack component="section" spacing={1}>
          <Typography level="title-sm" component="h3">{copy.archiveTitle}</Typography>
          <Stack component="ul" spacing={1} sx={{ p: 0, m: 0 }}>
            {archive.data.map((take) => (
              <Typography key={take.id} component="li" level="body-sm" sx={{ listStyle: "none" }}>
                {take.reviewer ? `${take.reviewer}: ` : ""}
                {take.review}
              </Typography>
            ))}
          </Stack>
        </Stack>
      )}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <Button component={Link} href={`/dashboard/reviews/new?album_id=${albumId}`} size="sm">
          {copy.reviewThisRelease}
        </Button>
        <Typography level="body-sm">{copy.nudge}</Typography>
      </Stack>
    </Stack>
  );
}
