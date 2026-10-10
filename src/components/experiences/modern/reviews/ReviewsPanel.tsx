"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button, Link as JoyLink, Stack, Typography } from "@mui/joy";
import type { Review } from "@wxyc/shared";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useGetReviewsForReleaseQuery } from "@/lib/features/reviews/reviewApi";
import { useGetAlbumReviewsForReleaseQuery } from "@/lib/features/reviews/albumReviewApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { REVIEW_COPY } from "./copy";
import FccNotesPanel from "./FccNotesPanel";
import PrintedVersionNote from "./PrintedVersionNote";
import { usePrintedVersion } from "./usePrintedVersion";
import SlipPreview, { SlipFccRow } from "./SlipPreview";

const { albumPanel: copy } = REVIEW_COPY;

type PanelRecord = { artist: string; album: string; label: string };

/** Named region of the album page that holds the album's FCC notes panel. */
export function FccNotesSlot({ albumId }: { albumId: number }) {
  return (
    <div data-testid="fcc-notes-slot" data-album-id={albumId}>
      <FccNotesPanel albumId={albumId} />
    </div>
  );
}

/** A review as the page shows it; `record` is set only when the review is about this page's own record, and `printable` only by the album page's panel, where that record is a library release. `onCover` says the review is on a cover now, which is what earns it the printed-version note and also decides the print link's name ("Print a new slip" only for a printed, edited cover review). */
export function ReviewItem({ review, record, newSlipHref, printable, onCover, children }: { review: Review; record?: PanelRecord; newSlipHref?: string; printable?: boolean; onCover: boolean; children?: ReactNode }) {
  const printedVersion = usePrintedVersion(review, { onCover });
  const onTheSleeve = review.medium === "handwritten" && !review.review;
  return (
    <Stack spacing={0.5} component="li" sx={{ listStyle: "none" }}>
      <PrintedVersionNote review={review} onCover={onCover} newSlipHref={newSlipHref} />
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
      {printable && record && review.medium === "typed" && review.status === "submitted" && (
        <RequireMD>
          <JoyLink component={Link} href={`/dashboard/admin/library/${review.album_id}/slip/${review.id}`} level="body-xs">
            {printedVersion === "edited" ? REVIEW_COPY.printedNote.printNew : REVIEW_COPY.intakeItem.printSlip}
          </JoyLink>
        </RequireMD>
      )}
      {review.revision_count > 1 && (
        <JoyLink component={Link} href={`/dashboard/reviews/${review.id}/history`} level="body-xs">
          {copy.history}
        </JoyLink>
      )}
      {children}
    </Stack>
  );
}

/** A headed list of reviews; `recordOf` names the record a review is about, or nothing for a review of a release this record cites. `extra` renders after each review, for a page's own lines and buttons. */
export function Group({ title, reviews, recordOf, newSlipHref, printable, onCover, extra }: { title: string; reviews: Review[]; recordOf: (review: Review) => PanelRecord | undefined; newSlipHref?: string; printable?: boolean; onCover: (review: Review) => boolean; extra?: (review: Review) => ReactNode }) {
  return (
    <Stack component="section" spacing={1}>
      <Typography level="title-sm" component="h3">{title}</Typography>
      <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }}>
        {reviews.map((review) => (
          <ReviewItem key={review.id} review={review} record={recordOf(review)} newSlipHref={newSlipHref} printable={printable} onCover={onCover(review)}>
            {extra?.(review)}
          </ReviewItem>
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
        <Group title={onCover.length > 1 ? copy.coverMany : copy.coverOne} reviews={onCover} recordOf={recordOf} printable onCover={(r) => r.on_cover} />
      )}
      {rest.length > 0 && (
        <Group title={onCover.length > 0 ? copy.others : copy.all} reviews={rest} recordOf={recordOf} printable onCover={(r) => r.on_cover} />
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
