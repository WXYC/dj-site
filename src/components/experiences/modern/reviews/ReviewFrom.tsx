"use client";

import { Typography } from "@mui/joy";
import type { IntakeItem, Review } from "@wxyc/shared";
import { namedAuthor } from "@/lib/features/reviews/author";
import { itemHolder, unheldPlace, type UnheldPlace } from "@/lib/features/reviews/holder";
import { byKind } from "@/lib/features/reviews/kind";
import { useGetItemReviewsQuery } from "@/lib/features/reviews/reviewApi";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

/** Newest first; reviews added the same day fall to the higher id. */
export const newestFirst = (a: Review, b: Review) => b.add_date.localeCompare(a.add_date) || b.id - a.id;

/** The location line for each place a record nobody has can be; none for a place no approved line names. */
const PLACE_LINE: Record<UnheldPlace, string | null> = {
  shelf: COPY.onShelf,
  office: COPY.backInOffice,
  burn: COPY.readyToBurn,
  unplaced: null,
  filed: null,
};

/**
 * The location line for a record nobody has, or null when it has none. The Review waiting lane and the
 * record page's chip both read it, so they cannot disagree with each other or with `fromLine`.
 */
export const placeLine = (item: IntakeItem): string | null => PLACE_LINE[unheldPlace(item)];

/**
 * The From line for each place a record nobody has can be. `shelf` shows only on a stale list: a record with a
 * waiting review is off the review shelf. A filed record says nothing (WXYC/dj-site#1991).
 */
const FROM_PLACE: Record<UnheldPlace, ((author: string) => string) | null> = {
  shelf: COPY.fromShelf,
  office: COPY.fromBackInOffice,
  burn: COPY.fromReadyToBurn,
  unplaced: COPY.fromAuthor,
  filed: null,
};

/**
 * Where a waiting review's author stands against the record, in the station's words. Null when the author
 * is unknown, and for a filed record nobody has. Names are real names: station display only, never telemetry.
 */
export function fromLine(review: Review, item: IntakeItem): string | null {
  const author = namedAuthor(review);
  const holder = itemHolder(item);
  if (!author) {
    return null;
  }
  if (holder.kind === "removed") {
    return byKind(item, { disc: COPY.fromRemoved, digital: COPY.fromTakenRemoved })(author);
  }
  if (holder.kind === "none") {
    return FROM_PLACE[unheldPlace(item)]?.(author) ?? null;
  }
  if (holder.id !== null && holder.id === review.author_user_id) {
    return byKind(item, { disc: COPY.fromHolder, digital: COPY.fromTaker })(author);
  }
  const elsewhere = byKind(item, { disc: COPY.fromWith, digital: COPY.fromTakenBy });
  return (holder.kind === "requested" ? COPY.fromHeldFor : elsewhere)(author, holder.name);
}

/**
 * A Review waiting row's lines: who the newest waiting review is from, and how many more wait. While the
 * row's reviews are being read, and if that read fails, the row shows `where`, the location line the lane
 * always showed. A record with no location line (a pool digital album with a review waiting) shows nothing then.
 */
export function WaitingFrom({ item, where }: { item: IntakeItem; where: string | null }) {
  const reviews = useGetItemReviewsQuery(item.id);
  if (!reviews.data) {
    return where ? <Typography level="body-sm">{where}</Typography> : null;
  }
  const waiting = reviews.data.filter((r) => r.status === "submitted" && r.id !== item.accepted_review_id).sort(newestFirst);
  const line = waiting.length > 0 ? fromLine(waiting[0], item) : null;
  return (
    <>
      {line && <Typography level="body-sm">{line}</Typography>}
      {waiting.length > 1 && <Typography level="body-sm">{COPY.more(waiting.length - 1)}</Typography>}
    </>
  );
}
