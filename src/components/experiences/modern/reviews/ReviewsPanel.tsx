"use client";

import { useId, useState, type ReactNode } from "react";
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
import { usePrintedVersion, type PrintedVersion } from "./usePrintedVersion";
import SlipPreview, { SlipFccRow } from "./SlipPreview";

const { albumPanel: copy } = REVIEW_COPY;

type PanelRecord = { artist: string; album: string; label: string };

/** How a review is drawn: the record page's full slip, the album card's four cover rows, or its author and a two-line excerpt. */
export type ReviewMode = "slip" | "cover" | "excerpt";

const clamp2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as const;

/** One of the cover's rows: a 6rem label column, an 8px gap and body-sm text, the same for all four. `tint` shades the row as a warning. */
function CoverRow({ label, tint, children, ...rest }: { label: string; tint?: boolean; children: ReactNode; "data-fcc-row"?: boolean }) {
  return (
    <Sheet {...rest} variant={tint ? "soft" : "plain"} color={tint ? "danger" : "neutral"} sx={{ display: "flex", gap: 1, p: 0.5 }}>
      <Typography level="body-sm" fontWeight="lg" sx={{ flex: "0 0 6rem" }}>{label}</Typography>
      <Typography level="body-sm" component="div" sx={{ whiteSpace: "pre-wrap" }}>{children}</Typography>
    </Sheet>
  );
}

/** Opens the full typed slip under a compact view of a review, on request. */
function ShowSlip({ slip }: { slip: ReactNode }) {
  const [open, setOpen] = useState(false);
  const slipId = useId();
  return (
    <>
      <Button variant="plain" size="sm" sx={{ alignSelf: "flex-start" }} aria-expanded={open} aria-controls={slipId} onClick={() => setOpen(!open)}>
        {copy.showSlip}
      </Button>
      {open && <div id={slipId}>{slip}</div>}
    </>
  );
}

/** The rows a DJ on the air needs, with the FCC row tinted when it has anything to say. The FCC row always shows; Buzzwords and Recommended are left off when empty; the Review row reads "on the sleeve" for a handwritten review without text. The typed slip opens under them on request. */
function CoverRows({ review, fccNotes, onTheSleeve, slip }: { review: Review; fccNotes: string[]; onTheSleeve: boolean; slip?: ReactNode }) {
  const { fields, slip: labels } = REVIEW_COPY;
  const fccLines = [review.fcc, ...fccNotes].filter(Boolean);
  const reviewBody = onTheSleeve ? copy.onTheSleeve : review.review;
  return (
    <Stack spacing={0.5}>
      <Typography level="body-xs">{review.author}</Typography>
      <CoverRow data-fcc-row label={fields.fcc.label} tint={fccLines.length > 0}>
        {fccLines.map((line, i) => <div key={i}>{line}</div>)}
      </CoverRow>
      {review.buzzwords && <CoverRow label={fields.buzzwords.label}>{review.buzzwords}</CoverRow>}
      {review.recommended_tracks && <CoverRow label={labels.recommended}>{review.recommended_tracks}</CoverRow>}
      {reviewBody && <CoverRow label={labels.review}>{reviewBody}</CoverRow>}
      {slip && <ShowSlip slip={slip} />}
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

/** A review as the page shows it; `record` is set only when the review is about this page's own record, and `printable` only by the album page's panel, where that record is a library release. `onCover` says the review is on a cover now, which is what earns it the printed-version note and also decides the print link's name ("Print a new slip" only for a printed, edited cover review). `lead` renders under the slip, before History, for a page's own print button; it is given the printed version this item's note and print link read, so a page need not decide it a second time. */
export function ReviewItem({ review, record, newSlipHref, printable, onCover, mode = "slip", showSlip, fccNotes = [], lead, children }: { review: Review; record?: PanelRecord; newSlipHref?: string; printable?: boolean; onCover: boolean; mode?: ReviewMode; showSlip?: boolean; fccNotes?: string[]; lead?: (printedVersion: PrintedVersion) => ReactNode; children?: ReactNode }) {
  const printedVersion = usePrintedVersion(review, { onCover });
  const onTheSleeve = review.medium === "handwritten" && !review.review;
  const slip = <SlipPreview {...record} reviewer={review.author ?? ""} date={review.add_date} fields={review} fccNotes={fccNotes} onCover={onCover} />;
  return (
    <Stack spacing={0.5} component="li" sx={{ listStyle: "none" }}>
      <PrintedVersionNote review={review} onCover={onCover} newSlipHref={newSlipHref} />
      {mode === "cover" ? (
        <CoverRows review={review} fccNotes={fccNotes} onTheSleeve={onTheSleeve} slip={!onTheSleeve ? slip : undefined} />
      ) : onTheSleeve ? (
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
          {showSlip && <ShowSlip slip={slip} />}
        </>
      ) : (
        slip
      )}
      {lead?.(printedVersion)}
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

/** A headed list of reviews; `recordOf` names the record a review is about, or nothing for a review of a release this record cites. `titleExtra` sits beside the heading, `intro` renders under it, `lead` under each review's slip (given the review and its printed version) and `extra` after each review, for a page's own lines and buttons. `showSlip` offers each excerpt's full slip on request. */
export function Group({ title, titleExtra, intro, reviews, recordOf, newSlipHref, printable, onCover, mode, showSlip, fccNotes, lead, extra }: { title?: string; titleExtra?: ReactNode; intro?: ReactNode; reviews: Review[]; recordOf: (review: Review) => PanelRecord | undefined; newSlipHref?: string; printable?: boolean; onCover: (review: Review) => boolean; mode?: ReviewMode; showSlip?: boolean; fccNotes?: string[]; lead?: (review: Review, printedVersion: PrintedVersion) => ReactNode; extra?: (review: Review) => ReactNode }) {
  return (
    <Stack component="section" spacing={1}>
      {title && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography level="title-sm" component="h3">{title}</Typography>
          {titleExtra}
        </Stack>
      )}
      {intro}
      <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }}>
        {reviews.map((review) => (
          <ReviewItem key={review.id} review={review} record={recordOf(review)} newSlipHref={newSlipHref} printable={printable} onCover={onCover(review)} mode={mode} showSlip={showSlip} fccNotes={fccNotes} lead={lead && ((printedVersion) => lead(review, printedVersion))}>
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
