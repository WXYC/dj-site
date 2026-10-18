import type { IntakeItem } from "@wxyc/shared";
import { isFiledState, recordKind } from "./kind";

/**
 * Who has a record. `requested` is a live request (the record is held for that
 * DJ, who has not taken it yet); `removed` is a checkout whose holder's account
 * no longer exists. Names are real names: station display only, never telemetry.
 */
export type Holder = { kind: "none" } | { kind: "removed" } | { kind: "requested" | "checked_out"; id: string | null; name: string };

/**
 * The one place a record's holder is worked out, so every lane and the record
 * page read it the same way. A removed account is `checked_out_by` null while
 * `checked_out_at` is set, never a missing name.
 */
export function itemHolder(item: IntakeItem): Holder {
  const state = item.effective_state;
  if (state === "pool") return { kind: "none" };
  if (state === "requested") return { kind: "requested", id: item.requested_dj_id, name: item.requested_dj_name ?? "" };
  if (item.checked_out_by) return { kind: "checked_out", id: item.checked_out_by, name: item.checked_out_by_name ?? "" };
  return item.checked_out_at && (state === "checked_out" || state === "reviewed") ? { kind: "removed" } : { kind: "none" };
}

/**
 * The one rule for "on the review shelf": nobody has the record and no submitted review waits on it. A
 * pool record with a review waiting stays off the shelf until a music director chooses or deletes that review.
 * `recordStage` draws its review shelf stage by this rule, so the Review shelf tab and the New music tab cannot disagree.
 */
export const onReviewShelf = (item: Pick<IntakeItem, "effective_state" | "submitted_review_count">): boolean =>
  item.effective_state === "pool" && item.submitted_review_count === 0;

/**
 * Where a record nobody has is, so every line that says it (the location line, the From line, the record page's
 * chip) reads one answer: `shelf` on the review shelf; `office` a disc off it; `burn` a reviewed digital album;
 * `unplaced` a pool digital album with a review waiting, for which no place fits; `filed` a filed or finalized record.
 * Call it only for a record whose `itemHolder` is `none`.
 */
export type UnheldPlace = "shelf" | "office" | "burn" | "unplaced" | "filed";

export function unheldPlace(item: Pick<IntakeItem, "effective_state" | "submitted_review_count" | "digital">): UnheldPlace {
  if (onReviewShelf(item)) {
    return "shelf";
  }
  if (isFiledState(item.effective_state)) {
    return "filed";
  }
  if (recordKind(item) === "disc") {
    return "office";
  }
  return item.effective_state === "pool" ? "unplaced" : "burn";
}

/** The stage a record is drawn in, one per record. */
export type ReviewStage = "filed" | "reviewed" | "waiting" | "requested" | "being_reviewed" | "review_shelf";

/** The fields a record's stage is read from. */
type StageFields = Pick<IntakeItem, "effective_state" | "submitted_review_count" | "accepted_review_id">;

/**
 * Whether a submitted review waits on the record for a music director to choose: the server's `awaiting_acceptance=true`
 * filter (a submitted review, none chosen, a state before filed), read from the fields every `IntakeItem` carries.
 */
export const reviewWaiting = (item: StageFields): boolean =>
  item.submitted_review_count > 0 && item.accepted_review_id == null && !isFiledState(item.effective_state);

/**
 * The one place a record's stage is worked out, first match winning. A submitted review does not change a record's state, so a
 * record with a review waiting is Review waiting whoever holds it, unless a review has already been chosen. It reads only the
 * record, so every lane drawn from one read is one partition of it.
 */
export function recordStage(item: StageFields): ReviewStage {
  const state = item.effective_state;
  if (isFiledState(state)) {
    return "filed";
  }
  if (state === "reviewed") {
    return "reviewed";
  }
  if (reviewWaiting(item)) {
    return "waiting";
  }
  if (state === "requested") {
    return "requested";
  }
  if (state === "checked_out") {
    return "being_reviewed";
  }
  // A pool record off the review shelf with no review waiting has a chosen review. The backend does not produce that
  // (choosing a review moves the record to reviewed), so it is drawn where a chosen review is.
  return onReviewShelf(item) ? "review_shelf" : "reviewed";
}
