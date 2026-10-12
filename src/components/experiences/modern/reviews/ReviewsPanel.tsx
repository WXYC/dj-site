"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Link as JoyLink, Sheet, Stack, Typography } from "@mui/joy";
import type { Review } from "@wxyc/shared";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useGetReviewsForReleaseQuery } from "@/lib/features/reviews/reviewApi";
import { useGetAlbumReviewsForReleaseQuery } from "@/lib/features/reviews/albumReviewApi";
import { useGetFccNotesQuery } from "@/lib/features/reviews/fccNoteApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { REVIEW_COPY } from "./copy";
import FccNotesPanel from "./FccNotesPanel";
import PrintedVersionNote from "./PrintedVersionNote";
import { usePrintedVersion } from "./usePrintedVersion";
import SlipPreview, { SlipFccRow } from "./SlipPreview";

const { albumPanel: copy } = REVIEW_COPY;

type PanelRecord = { artist: string; album: string; label: string };

/** How a review is drawn: the record page's full slip, the album card's four cover rows, or its author and a two-line excerpt. */
export type ReviewMode = "slip" | "cover" | "excerpt";

const clamp2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as const;

/** The four rows a DJ on the air needs, with the FCC row tinted when it has anything to say. The full slip opens under them on request. */
function CoverRows({ review, fccNotes, slip }: { review: Review; fccNotes: string[]; slip: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { fields, slip: labels } = REVIEW_COPY;
  const row = (label: string, body?: string | null) => (
    <Stack direction="row" spacing={1}>
      <Typography level="body-sm" fontWeight="lg" sx={{ flex: "0 0 6rem" }}>{label}</Typography>
      <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>{body}</Typography>
    </Stack>
  );
  const hasFcc = !!review.fcc || fccNotes.length > 0;
  return (
    <Stack spacing={0.5}>
      <Typography level="body-xs">{review.author}</Typography>
      <Sheet data-fcc-row variant={hasFcc ? "soft" : "plain"} color={hasFcc ? "danger" : "neutral"} sx={{ p: 0.5 }}>
        <SlipFccRow fcc={review.fcc} notes={fccNotes} />
      </Sheet>
      {row(fields.buzzwords.label, review.buzzwords)}
      {row(labels.recommended, review.recommended_tracks)}
      {row(labels.review, review.review)}
      <Button variant="plain" size="sm" sx={{ alignSelf: "flex-start" }} aria-expanded={open} onClick={() => setOpen(!open)}>
        {copy.showSlip}
      </Button>
      {open && slip}
    </Stack>
  );
}

/** Named region of the album page that holds the album's FCC notes panel. */
export function FccNotesSlot({ albumId }: { albumId: number }) {
  return (
    <div data-testid="fcc-notes-slot" data-album-id={albumId}>
      <FccNotesPanel albumId={albumId} />
    </div>
  );
}

/** A review as the page shows it; `record` is set only when the review is about this page's own record, and `printable` only by the album page's panel, where that record is a library release. `onCover` says the review is on a cover now, which is what earns it the printed-version note and also decides the print link's name ("Print a new slip" only for a printed, edited cover review). */
export function ReviewItem({ review, record, newSlipHref, printable, onCover, mode = "slip", fccNotes = [], children }: { review: Review; record?: PanelRecord; newSlipHref?: string; printable?: boolean; onCover: boolean; mode?: ReviewMode; fccNotes?: string[]; children?: ReactNode }) {
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
      ) : mode === "excerpt" ? (
        <>
          <Typography level="body-sm" fontWeight="lg">{review.author}</Typography>
          <Typography level="body-sm" sx={clamp2}>{review.review}</Typography>
        </>
      ) : mode === "cover" ? (
        <CoverRows review={review} fccNotes={fccNotes} slip={<SlipPreview {...record} reviewer={review.author ?? ""} date={review.add_date} fields={review} fccNotes={fccNotes} onCover={onCover} />} />
      ) : (
        <SlipPreview {...record} reviewer={review.author ?? ""} date={review.add_date} fields={review} onCover={onCover} />
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
export function Group({ title, reviews, recordOf, newSlipHref, printable, onCover, mode, fccNotes, extra }: { title: string; reviews: Review[]; recordOf: (review: Review) => PanelRecord | undefined; newSlipHref?: string; printable?: boolean; onCover: (review: Review) => boolean; mode?: ReviewMode; fccNotes?: string[]; extra?: (review: Review) => ReactNode }) {
  return (
    <Stack component="section" spacing={1}>
      <Typography level="title-sm" component="h3">{title}</Typography>
      <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }}>
        {reviews.map((review) => (
          <ReviewItem key={review.id} review={review} record={recordOf(review)} newSlipHref={newSlipHref} printable={printable} onCover={onCover(review)} mode={mode} fccNotes={fccNotes}>
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

  const fccNotes = useGetFccNotesQuery({ album_id: albumId }, { skip: !visible });

  if (!visible) return null;

  const confirmed = (fccNotes.data ?? []).filter((n) => n.status === "confirmed").map((n) => `${n.track}: ${n.note}`);
  const recordOf = (review: Review) => (review.album_id === albumId ? record : undefined);
  const onCover = reviews.data?.filter((r) => r.on_cover) ?? [];
  const rest = reviews.data?.filter((r) => !r.on_cover) ?? [];

  return (
    <Stack spacing={1.5} sx={{ my: 1 }}>
      {reviews.isError && <Typography role="alert">{copy.loadFailed}</Typography>}
      {onCover.length > 0 && (
        <Group title={onCover.length > 1 ? copy.coverMany : copy.coverOne} reviews={onCover} recordOf={recordOf} printable onCover={(r) => r.on_cover} mode="cover" fccNotes={confirmed} />
      )}
      <FccNotesSlot albumId={albumId} />
      {rest.length > 0 && (
        <Group title={onCover.length > 0 ? copy.others : copy.all} reviews={rest} recordOf={recordOf} printable onCover={(r) => r.on_cover} mode="excerpt" />
      )}
      {!!archive.data?.length && (
        <Stack component="section" spacing={1}>
          <Typography level="title-sm" component="h3">{copy.archiveTitle}</Typography>
          <Stack component="ul" spacing={1} sx={{ p: 0, m: 0 }}>
            {archive.data.map((take) => (
              <Stack key={take.id} component="li" spacing={0.25} sx={{ listStyle: "none" }}>
                <Typography component="blockquote" level="body-sm" sx={{ m: 0 }}>{take.review}</Typography>
                {take.reviewer && <Typography level="body-xs">{take.reviewer}</Typography>}
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
      <Sheet variant="soft" sx={{ p: 1, borderRadius: "sm" }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Button component={Link} href={`/dashboard/reviews/new?album_id=${albumId}`} size="sm">
            {copy.reviewThisRelease}
          </Button>
          <Typography level="body-sm">{copy.nudge}</Typography>
        </Stack>
      </Sheet>
    </Stack>
  );
}
