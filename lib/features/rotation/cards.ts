import type { RotationCard } from "@wxyc/shared";
import { bodyReason, unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import {
  ROTATION_CARD_DELETE_CONFLICT_REASONS,
  type RotationBin,
  type RotationCardDeleteConflictReason,
  type RotationCardWithCount,
} from "./types";

/**
 * Cards grouped per bin, each bin's cards in number order — the order the
 * physical cards sit in. Generic so the counted cards-surface rows and the
 * plain published card both group without a cast; a bin with no cards has no
 * entry, so consumers default to the empty list.
 */
export function groupRotationCardsByBin<Card extends RotationCard>(
  cards: readonly Card[],
): ReadonlyMap<RotationBin, Card[]> {
  const byBin = new Map<RotationBin, Card[]>();
  for (const card of cards) {
    const list = byBin.get(card.bin) ?? [];
    list.push(card);
    byBin.set(card.bin, list);
  }
  for (const list of byBin.values()) list.sort((left, right) => left.number - right.number);
  return byBin;
}

/**
 * Whether the delete affordance is live. Two clauses mirror the server's own
 * conjunctive guard — highest-numbered in its bin AND zero active rows — so
 * the UI disables rather than inviting a write that will be refused, with
 * the 409 kept reachable as the race backstop (another MD adds a card or
 * files a row between this render and the click), never as the normal path.
 * The third clause is this surface's own: a bin's only card is never
 * deletable, even empty. A bin emptied of cards has no "newest card" for
 * the server to default an omitted rotation-add `card_id` onto, and the
 * admin list drops that bin's card controls entirely — a state the
 * contiguous-1…N numbering rule exists to keep unreachable, and one the
 * server would accept, so no 409 backstops it.
 */
export function canDeleteRotationCard(
  card: RotationCardWithCount,
  binCards: readonly RotationCard[],
): boolean {
  return (
    card.active_count === 0 &&
    binCards.length > 1 &&
    binCards.every((sibling) => sibling.number <= card.number)
  );
}

/**
 * The typed reason off a wrapped rotation-cards DELETE rejection
 * (`{rotationWriteError: {status, data: {message, reason}}}` — the shape
 * `wrapRotationWriteError` gives `.unwrap()`), or `null` for every other
 * failure. Membership in the closed reason set is the identification: only
 * the delete guard's 409 carries one of these strings.
 */
export function rotationCardDeleteConflictReason(
  err: unknown,
): RotationCardDeleteConflictReason | null {
  const reason = bodyReason(unwrapEndpointError("rotationWriteError", err)?.data);
  const match = ROTATION_CARD_DELETE_CONFLICT_REASONS.find((candidate) => candidate === reason);
  return match ?? null;
}

/**
 * The per-reason sentence for a delete 409 — named for the state that
 * refused, since each reason has its own remedy: a stale "last card" wants a
 * refresh, a card with active rows wants those rows moved or killed first.
 */
export function rotationCardDeleteConflictMessage(
  reason: RotationCardDeleteConflictReason,
): string {
  switch (reason) {
    case "card_not_highest_in_bin":
      return "This card is no longer the last in its bin — bins shrink only from the top.";
    case "card_has_active_rotations":
      return "This card still has active rotation releases filed on it — move or kill them first.";
  }
}
