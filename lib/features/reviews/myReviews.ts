import type { IntakeItem, Review } from "@wxyc/shared";

export const STAGES = ["open", "submitted", "cover"] as const;
export type Stage = (typeof STAGES)[number];

/** One row of the My reviews tab: a request to the DJ, a record the DJ has, or a review of a record the DJ does not have. */
export type MyReviewsRow = { kind: "request" | "held"; item: IntakeItem } | { kind: "review"; review: Review };

export const rowKey = (row: MyReviewsRow): string => (row.kind === "review" ? `review-${row.review.id}` : `${row.kind}-${row.item.id}`);

const isHeldBy = (item: IntakeItem, me: string | undefined): boolean =>
  (item.effective_state === "checked_out" || item.effective_state === "reviewed") && item.checked_out_by === me;

const when = (r: Review): number => Date.parse(r.submitted_at ?? r.last_modified);

/**
 * Sorts the DJ's work into the My reviews tab's three stages. `reviews` is the DJ's own list. A held record is one row: in the stage of its newest submitted review, else in Open reviews. A lapsed request (`effective_state` `pool`) is no request.
 * Open reviews lists requests, then overdue records, then the rest; Submitted and On the cover list newest first. A draft on a record the DJ no longer has, and a draft of a library release, are Open reviews.
 */
export function sortMyReviews(items: IntakeItem[], reviews: Review[], me: string | undefined): Record<Stage, MyReviewsRow[]> {
  const heldItems = new Map(items.filter((i) => isHeldBy(i, me)).map((i) => [i.id, i]));
  const lanes: Record<Stage, MyReviewsRow[]> = { open: [], submitted: [], cover: [] };
  const placed = new Set<number>();
  const newestFirst = [...reviews].sort((a, b) => when(b) - when(a));

  for (const review of newestFirst.filter((r) => r.status === "submitted")) {
    const item = review.intake_item_id === null ? undefined : heldItems.get(review.intake_item_id);
    const takesRecord = item !== undefined && !placed.has(item.id);
    if (takesRecord) {
      placed.add(item.id);
    }
    lanes[review.in_use ? "cover" : "submitted"].push(takesRecord ? { kind: "held", item } : { kind: "review", review });
  }

  const requests = items.filter((i) => i.effective_state === "requested" && i.requested_dj_id === me);
  const unplaced = [...heldItems.values()].filter((i) => !placed.has(i.id));
  const drafts = newestFirst.filter((r) => r.status === "draft" && (r.intake_item_id === null || !heldItems.has(r.intake_item_id)));
  lanes.open = [
    ...requests.map((item): MyReviewsRow => ({ kind: "request", item })),
    ...unplaced.filter((i) => i.overdue).map((item): MyReviewsRow => ({ kind: "held", item })),
    ...unplaced.filter((i) => !i.overdue).map((item): MyReviewsRow => ({ kind: "held", item })),
    ...drafts.map((review): MyReviewsRow => ({ kind: "review", review })),
  ];
  return lanes;
}
