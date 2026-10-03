import type { RotationCard } from "@wxyc/shared";
import { bodyReason, unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import { rowMatchesTerms, searchTerms } from "./adminList";
import {
  ROTATION_CARD_DELETE_CONFLICT_REASONS,
  type RotationBin,
  type RotationCardDeleteConflictReason,
  type RotationCardWithCount,
  type RotationListRow,
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
 * Which ticked rows the card-assignment batch save
 * (`useCardAssignmentSave`) actually sends: the ticked rows in `binActiveRows`
 * that belong to `card`'s bin and are not already filed on it. A row ticked
 * from another bin is never returned -- the panel shows one bin's active
 * rows at a time, but a stale tick set carried across a bin switch must
 * never become a cross-bin move.
 */
export function rotationRowsToMoveOntoCard(
  binActiveRows: readonly RotationListRow[],
  card: RotationCard,
  tickedRowIds: readonly number[],
): number[] {
  const ticked = new Set(tickedRowIds);
  return binActiveRows
    .filter((row) => row.rotation_bin === card.bin && ticked.has(row.rotation_id))
    .filter((row) => row.card?.id !== card.id)
    .map((row) => row.rotation_id);
}

/** The card-assignment panel's search text plus the "still on card 1" toggle. */
export type CardAssignmentQuery = { search: string; stillOnFirstCardOnly: boolean };

/** The panel's two sections, already filtered and ordered. */
export type CardAssignmentRows = {
  here: RotationListRow[];
  elsewhere: RotationListRow[];
};

// Built once at module level, and pinned to "en" rather than a runtime
// default, so the order a viewer sees never shifts with their browser's
// locale or a CI runner's.
const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base" });

/** Accent- and case-insensitive string comparison, so letters NFD cannot decompose (`ł`, `ø`) still sort by base letter. */
function compareNames(left: string | null, right: string | null): number {
  return NAME_COLLATOR.compare(left ?? "", right ?? "");
}

/** The one display string for a record, shared by the panel's rows and the Cards tab's list. */
export function rotationRecordLabel(row: RotationListRow): string {
  return `${row.artist_name ?? "Unknown artist"} — ${row.album_title ?? "Untitled"}`;
}

/**
 * A card's records in the order the panel gives its "On <card> now" section:
 * artist, then album title, then rotation id, for a stable total order.
 */
function byArtistThenTitle(left: RotationListRow, right: RotationListRow): number {
  return (
    compareNames(left.artist_name, right.artist_name) ||
    compareNames(left.album_title, right.album_title) ||
    left.rotation_id - right.rotation_id
  );
}

// A card-less row is unplaced, like the pile, so it sorts ahead of card 1
// rather than behind every numbered card.
function byCardThenArtistThenTitle(left: RotationListRow, right: RotationListRow): number {
  return (
    (left.card?.number ?? 0) - (right.card?.number ?? 0) ||
    compareNames(left.artist_name, right.artist_name) ||
    compareNames(left.album_title, right.album_title) ||
    left.rotation_id - right.rotation_id
  );
}

/**
 * Active rows grouped by the id of the card they sit on, each group in
 * `byArtistThenTitle` order. The rows arrive grouped by a hash, so the sort is
 * explicit. A card with no rows has no entry.
 */
export function groupRotationRowsByCardId(
  rows: readonly RotationListRow[],
): ReadonlyMap<number, RotationListRow[]> {
  const byCardId = new Map<number, RotationListRow[]>();
  for (const row of rows) {
    if (row.card == null) continue;
    const list = byCardId.get(row.card.id) ?? [];
    list.push(row);
    byCardId.set(row.card.id, list);
  }
  for (const list of byCardId.values()) list.sort(byArtistThenTitle);
  return byCardId;
}

/**
 * The panel's "On `<card>` now" and "Elsewhere" sections, filtered and
 * ordered -- the component does neither of its own. Search (the matcher
 * `selectRotationAdminView` also uses) narrows both; the "still on card 1"
 * toggle narrows elsewhere only, since a member is never a pile candidate.
 * A ticked row that search or the toggle hides is still one
 * `rotationRowsToMoveOntoCard` sends, since that reads the ticked ids
 * against the un-narrowed rows this function is given.
 *
 * "On `<card>` now" orders by artist, then album title, then rotation id,
 * for a stable total order. Elsewhere orders by card number first -- a
 * card-less row sorts ahead of card 1 -- then the same artist/title
 * tiebreak.
 */
export function narrowCardAssignmentRows(
  binRows: readonly RotationListRow[],
  card: RotationCard,
  query: CardAssignmentQuery,
): CardAssignmentRows {
  const terms = searchTerms(query.search);
  const matching = binRows.filter((row) => rowMatchesTerms(row, terms));
  // The panel hides the toggle's own checkbox when the open card is card 1 --
  // there is no lower card for it to mean anything against -- so a stale or
  // defensively-passed `true` here must not narrow either: card 1 never
  // filters by itself.
  const toggleActive = query.stillOnFirstCardOnly && card.number !== 1;
  return {
    here: matching.filter((row) => row.card?.id === card.id).sort(byArtistThenTitle),
    elsewhere: matching
      .filter((row) => row.card?.id !== card.id)
      .filter((row) => !toggleActive || row.card?.number === 1)
      .sort(byCardThenArtistThenTitle),
  };
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
