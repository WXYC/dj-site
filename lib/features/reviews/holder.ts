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
