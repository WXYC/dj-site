"use client";

import { Typography } from "@mui/joy";
import type { IntakeItem, Review } from "@wxyc/shared";
import { itemHolder } from "@/lib/features/reviews/holder";
import { useGetItemReviewsQuery } from "@/lib/features/reviews/reviewApi";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

/** Newest first; reviews added the same day fall to the higher id. */
export const newestFirst = (a: Review, b: Review) => b.add_date.localeCompare(a.add_date) || b.id - a.id;

/**
 * Where a waiting review's author stands against the record, in the station's words. Null when the author
 * is unknown, and when nobody has a record that is no longer on the review shelf: no approved line says
 * where such a record is. Names are real names: station display only, never telemetry.
 */
export function fromLine(review: Review, item: IntakeItem): string | null {
  const { author } = review;
  const holder = itemHolder(item);
  if (!author) return null;
  if (holder.kind === "removed") return COPY.fromRemoved(author);
  if (holder.kind === "none") return item.effective_state === "pool" ? COPY.fromShelf(author) : null;
  if (holder.id !== null && holder.id === review.author_user_id) return COPY.fromHolder(author);
  return (holder.kind === "requested" ? COPY.fromHeldFor : COPY.fromWith)(author, holder.name);
}

/**
 * A Review waiting row's lines: who the newest waiting review is from, and how many more wait. While the
 * row's reviews are being read, and if that read fails, the row shows `where`, the location line the lane
 * always showed, so it is never blank.
 */
export function WaitingFrom({ item, where }: { item: IntakeItem; where: string }) {
  const reviews = useGetItemReviewsQuery(item.id);
  if (!reviews.data) return <Typography level="body-sm">{where}</Typography>;
  const waiting = reviews.data.filter((r) => r.status === "submitted" && r.id !== item.accepted_review_id).sort(newestFirst);
  const line = waiting.length > 0 ? fromLine(waiting[0], item) : null;
  return (
    <>
      {line && <Typography level="body-sm">{line}</Typography>}
      {waiting.length > 1 && <Typography level="body-sm">{COPY.more(waiting.length - 1)}</Typography>}
    </>
  );
}
