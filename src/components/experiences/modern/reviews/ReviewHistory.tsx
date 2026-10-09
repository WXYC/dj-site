"use client";

import { useEffect } from "react";
import { notFound } from "next/navigation";
import { Stack, Typography } from "@mui/joy";
import type { Review, ReviewRevision } from "@wxyc/shared";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { useGetReviewQuery, useGetReviewRevisionsQuery } from "@/lib/features/reviews/reviewApi";
import { formatStationTimestampLabel } from "@/src/utilities/stationTime";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { REVIEW_COPY } from "./copy";
import SlipPreview from "./SlipPreview";

const copy = REVIEW_COPY.history;

function Row({ id, heading, marks, byline, at, fields }: {
  id?: string;
  heading?: string;
  marks: string[];
  byline: string;
  at: string | null;
  fields: ReviewRevision | Review;
}) {
  return (
    <Stack component="li" id={id} spacing={0.5} sx={{ listStyle: "none" }}>
      <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
        {heading && <Typography level="title-sm">{heading}</Typography>}
        <Typography level="body-sm">{[byline, at].filter(Boolean).join(" · ")}</Typography>
        {marks.map((mark) => <Typography key={mark} level="body-xs" fontWeight="lg">{mark}</Typography>)}
      </Stack>
      <SlipPreview fields={fields} />
    </Stack>
  );
}

/** A review's saved versions, newest first; read-only. */
export default function ReviewHistory({ id }: { id: number }) {
  const visible = useCanSeeReviews();
  const review = useGetReviewQuery(id, { skip: !visible });
  const submitted = review.data?.status === "submitted";
  const revisions = useGetReviewRevisionsQuery(id, { skip: !visible || !submitted });
  const ready = submitted && revisions.data !== undefined;

  useEffect(() => {
    if (ready && window.location.hash === "#printed") document.getElementById("printed")?.scrollIntoView?.();
  }, [ready]);

  if (!visible) return null;
  if ((review.error as { status?: number } | undefined)?.status === 404) notFound();
  if ([review, revisions].some(hasNothingToShow)) return <Typography role="alert">{copy.loadFailed}</Typography>;
  if (!review.data) return null;
  if (!submitted) return <Typography>{copy.draft}</Typography>;
  if (!revisions.data) return null;
  const { printed_revision_id: printedId } = review.data;

  const rows = [...revisions.data].sort((a, b) => b.revision - a.revision);
  return (
    <Stack component="ol" spacing={2} sx={{ p: 0, m: 0 }}>
      {rows.length === 0 ? (
        <Row
          marks={[copy.current]}
          byline={copy.submittedBy(review.data.author)}
          at={formatStationTimestampLabel(review.data.submitted_at)}
          fields={review.data}
        />
      ) : (
        rows.map((row, i) => {
          const printed = row.id === printedId;
          return (
            <Row
              key={row.id}
              id={printed ? "printed" : undefined}
              heading={copy.version(row.revision)}
              marks={[...(i === 0 ? [copy.current] : []), ...(printed ? [copy.onTheCover] : [])]}
              byline={row.revision === 1 ? copy.submittedBy(row.edited_by) : copy.editedBy(row.edited_by)}
              at={formatStationTimestampLabel(row.edited_at)}
              fields={row}
            />
          );
        })
      )}
    </Stack>
  );
}
