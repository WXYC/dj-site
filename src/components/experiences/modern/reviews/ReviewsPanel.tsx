"use client";

import Link from "next/link";
import { Button, Link as JoyLink, Stack, Typography } from "@mui/joy";
import type { Review } from "@wxyc/shared";
import { useGetReviewsForReleaseQuery } from "@/lib/features/reviews/reviewApi";
import { useGetAlbumReviewsForReleaseQuery } from "@/lib/features/reviews/albumReviewApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { REVIEW_COPY } from "./copy";
import SlipPreview, { SlipFccRow } from "./SlipPreview";

const { albumPanel: copy } = REVIEW_COPY;

type PanelRecord = { artist: string; album: string; label: string };

/** Named empty region the album's FCC notes are rendered into. */
export function FccNotesSlot({ albumId }: { albumId: number }) {
  return <div data-testid="fcc-notes-slot" data-album-id={albumId} />;
}

function ReviewItem({ review, albumId, record }: { review: Review; albumId: number; record: PanelRecord }) {
  const onTheSleeve = review.medium === "handwritten" && !review.review;
  return (
    <Stack spacing={0.5} component="li" sx={{ listStyle: "none" }}>
      {onTheSleeve ? (
        <>
          <Typography level="body-sm">
            {review.author} · {copy.onTheSleeve}
          </Typography>
          {review.fcc && <SlipFccRow fcc={review.fcc} />}
        </>
      ) : (
        // A review of a release this copy cites is not about this page's record.
        <SlipPreview {...(review.album_id === albumId ? record : {})} reviewer={review.author ?? ""} date={review.add_date} fields={review} />
      )}
      {review.revision_count > 1 && (
        <JoyLink component={Link} href={`/dashboard/reviews/${review.id}/history`} level="body-xs">
          {copy.history}
        </JoyLink>
      )}
    </Stack>
  );
}

function Group({ title, reviews, albumId, record }: { title: string; reviews: Review[]; albumId: number; record: PanelRecord }) {
  return (
    <Stack component="section" spacing={1}>
      <Typography level="title-sm" component="h3">{title}</Typography>
      <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }}>
        {reviews.map((review) => (
          <ReviewItem key={review.id} review={review} albumId={albumId} record={record} />
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

  const onCover = reviews.data?.filter((r) => r.on_cover) ?? [];
  const rest = reviews.data?.filter((r) => !r.on_cover) ?? [];

  return (
    <Stack spacing={1.5} sx={{ my: 1 }}>
      <FccNotesSlot albumId={albumId} />
      {reviews.isError && <Typography role="alert">{copy.loadFailed}</Typography>}
      {onCover.length > 0 && (
        <Group title={onCover.length > 1 ? copy.coverMany : copy.coverOne} reviews={onCover} albumId={albumId} record={record} />
      )}
      {rest.length > 0 && (
        <Group title={onCover.length > 0 ? copy.others : copy.all} reviews={rest} albumId={albumId} record={record} />
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
