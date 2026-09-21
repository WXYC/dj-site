import {
  bodyReason,
  serverMessage,
  unwrapEndpointError,
  unwrapEndpointErrorOrRaw,
} from "@/lib/rtk-endpoint-error";
import type { ArtistCard } from "./types";

/**
 * Why `DELETE /library/artists/:id` did not delete. Follows
 * `releaseDeleteOutcome.ts`'s taxonomy: `unknown` is every shape this module
 * refuses to interpret -- a 5xx, a non-JSON body, a network failure, or a
 * `reason` it has never heard of -- and stays apart from `indeterminate` on
 * purpose. "The server said no" and "we could not tell what the server said"
 * must not read alike on a screen whose next action is irreversible.
 *
 * The four 409 reasons are named individually rather than folded into one
 * "has dependents" case because each maps 1:1 to one of the five counts
 * `ArtistCard` already carries (`release_count`, `cross_reference_source_count`,
 * `cross_reference_target_count`, `library_cross_reference_count`) -- a caller
 * that reads those off the card before offering the delete control can name
 * the exact blocker without eating a 409 blind. The card's fifth count,
 * `compilation_credit_count`, has no reason here: it is informational only
 * and never refuses (see `ArtistCard`'s own docblock for why).
 */
export type ArtistDeleteBlockingReason =
  | "artist_has_releases"
  | "artist_crossreference_source"
  | "artist_crossreference_target"
  | "artist_library_crossreference";

export type ArtistDeleteRefusalReason =
  | ArtistDeleteBlockingReason
  | "lock_unavailable"
  | "not_found"
  | "indeterminate"
  | "unknown";

export type ArtistDeleteRefusal = {
  reason: ArtistDeleteRefusalReason;
  /** The sentence to put in front of the librarian. Never empty. */
  message: string;
  /**
   * True only for the lock stand-down and an indeterminate answer -- the two
   * outcomes where pressing Delete again is the correct next move. A refusal
   * on the merits and a classified-but-unrecognised reply are both false:
   * repeating either is either futile or a guess.
   */
  retryable: boolean;
};

export const ARTIST_DELETE_LOCK_MESSAGE =
  "Could not delete: the artist is being written to right now. Try again in a moment.";

/**
 * A 404 here is very often the second click of a double-submit, so it is
 * worded as the outcome the librarian wanted rather than as an error, the
 * same convention `RELEASE_DELETE_GONE_MESSAGE` follows.
 */
export const ARTIST_DELETE_GONE_MESSAGE =
  "This artist is no longer in the catalog. It may already have been deleted.";

export const ARTIST_DELETE_FALLBACK_MESSAGE =
  "This artist could not be deleted, and the reason could not be read. Nothing was changed.";

export const ARTIST_DELETE_INDETERMINATE_MESSAGE =
  "This artist may or may not have been deleted — no answer came back. Reload before trying again.";

/**
 * `${n} <noun>` when the server's count is a usable positive integer, or the
 * bare plural noun otherwise. A count this module cannot trust must not
 * become a number on screen, and must not take the rest of the sentence down
 * with it either -- the same guard `releaseDeleteDigitalAssetsMessage` applies
 * to `asset_count`.
 */
function countPhrase(count: unknown, singular: string): string {
  const plural = `${singular}s`;
  return typeof count === "number" && Number.isInteger(count) && count > 0
    ? `${count} ${count === 1 ? singular : plural}`
    : plural;
}

function bodyCount(data: unknown): unknown {
  if (!data || typeof data !== "object") return undefined;
  return (data as { count?: unknown }).count;
}

/**
 * Which condition blocks the delete, restating only the server's `count` --
 * shared with the pre-check below so a copy-edit here can't leave that
 * pre-check and the 409 it precedes describing one condition differently.
 */
export function artistDeleteBlockerClause(
  reason: ArtistDeleteBlockingReason,
  count: unknown,
): string {
  switch (reason) {
    case "artist_has_releases":
      return `it has ${countPhrase(count, "release")} on file`;
    case "artist_crossreference_source":
      return `it is the source of ${countPhrase(count, "cross-reference")} to other artists`;
    case "artist_crossreference_target":
      return `it is the target of ${countPhrase(count, "cross-reference")} from other artists`;
    case "artist_library_crossreference":
      return `it has ${countPhrase(count, "release cross-reference")} on file`;
  }
}

type ArtistDeleteGateKey =
  "release_count" | "cross_reference_source_count" | "cross_reference_target_count" | "library_cross_reference_count";

// One entry per gate the delete endpoint enforces, in `ArtistAdminServlet`'s
// check order. `compilation_credit_count` has none -- its FK is `ON DELETE
// SET NULL`, so a delete unlinks the credit rather than being blocked by it.
const ARTIST_DELETE_GATES: ReadonlyArray<{ key: ArtistDeleteGateKey; reason: ArtistDeleteBlockingReason }> = [
  { key: "release_count", reason: "artist_has_releases" },
  { key: "cross_reference_source_count", reason: "artist_crossreference_source" },
  { key: "cross_reference_target_count", reason: "artist_crossreference_target" },
  { key: "library_cross_reference_count", reason: "artist_library_crossreference" },
];

/**
 * Which of the four gating counts block a delete. Tested as `=== 0`, never
 * `> 0`: dj-site and Backend-Service deploy independently, and
 * `getArtistCard` carries no `transformResponse`, so a card served by a
 * Backend build predating these counts yields `undefined` for all five
 * while TypeScript still asserts `number`. Read as `> 0`, a caller offers a
 * delete that then 409s; read as `=== 0`, it withholds instead -- fails
 * closed.
 *
 * The one owner both `ArtistCard`'s link and `ArtistDeleteConfirm`'s Tier 1
 * read, so the entrance and the screen cannot disagree about whether a
 * delete is possible.
 */
export function artistDeleteBlockers(card: ArtistCard): string[] {
  return ARTIST_DELETE_GATES.filter((gate) => card[gate.key] !== 0).map((gate) =>
    artistDeleteBlockerClause(gate.reason, card[gate.key]),
  );
}

/** True only when nothing is filed under the artist -- see `artistDeleteBlockers`. */
export function artistDeleteIsOffered(card: ArtistCard): boolean {
  return artistDeleteBlockers(card).length === 0;
}

export const ARTIST_DELETE_COUNTS_UNREADABLE_MESSAGE =
  "What is filed under this artist could not be read, so a delete cannot be offered here. Reload the page.";

/**
 * The card carries no readable gating count, so `artistDeleteBlockers` has
 * named every gate for want of a number rather than because the shelf is
 * occupied. `countPhrase` keeps an untrusted count from becoming a number on
 * screen, but nothing stops an untrusted count from *selecting a clause*, and
 * four selected clauses assert four facts -- callers must ask this first and
 * say they cannot tell, instead of reciting blockers they have not observed.
 *
 * `undefined` here is the deploy-skew case `artistDeleteBlockers` documents:
 * a card served by a Backend build predating the counts.
 */
export function artistDeleteCountsUnreadable(card: ArtistCard): boolean {
  return ARTIST_DELETE_GATES.some((gate) => typeof card[gate.key] !== "number");
}

const ARTIST_DELETE_BLOCKING_TAIL: Record<ArtistDeleteBlockingReason, string> = {
  artist_has_releases: "Delete or move those releases first.",
  artist_crossreference_source: "Clear those cross-references first.",
  artist_crossreference_target: "Clear those cross-references first.",
  artist_library_crossreference: "Clear those cross-references first.",
};

/**
 * `Object.hasOwn`, not `in`: the body's `reason` is server-controlled text
 * reaching a plain object used as a lookup table, and `in` walks the
 * prototype chain -- a `reason` of `"toString"` or `"__proto__"` would
 * narrow this predicate to true and then hand the caller a non-function (or,
 * for `"__proto__"`, `Object.prototype` itself) to call.
 */
function isArtistDeleteBlockingReason(reason: string | undefined): reason is ArtistDeleteBlockingReason {
  return !!reason && Object.hasOwn(ARTIST_DELETE_BLOCKING_TAIL, reason);
}

/** Same reasoning as `deleteAnsweredWithoutWriting`: a sub-500 answer reached a handler that declined before writing; anything else may have written. */
export function artistDeleteAnsweredWithoutWriting(err: unknown): boolean {
  const status = unwrapEndpointErrorOrRaw("deleteArtistError", err)?.status;
  return typeof status === "number" && status < 500;
}

/**
 * Interprets a rejected `deleteArtist` into something a librarian can act on.
 *
 * Only the lock stand-down (503) prefers the server's own sentence, with a
 * fallback for when it sends none -- what a locked row is waiting on is detail
 * this module has no way to reconstruct client-side. Every other named outcome
 * is client-owned wording, the same split `releaseDeleteOutcome` and
 * `restoreDeletedBatchOutcome` both make.
 *
 * Status and `reason` must agree for every named outcome: a proxy can return a
 * bare status with no body at all, and a `reason` on the wrong status is not a
 * shape this endpoint produces.
 */
export function interpretArtistDeleteError(err: unknown): ArtistDeleteRefusal {
  const indeterminate: ArtistDeleteRefusal = {
    reason: "indeterminate",
    message: ARTIST_DELETE_INDETERMINATE_MESSAGE,
    retryable: true,
  };

  const inner = unwrapEndpointError("deleteArtistError", err);
  if (!inner) return indeterminate;
  const { status, data } = inner;
  const reason = bodyReason(data);

  if (status === 503 && reason === "lock_unavailable") {
    return {
      reason: "lock_unavailable",
      message: serverMessage(data) ?? ARTIST_DELETE_LOCK_MESSAGE,
      retryable: true,
    };
  }

  if (status === 409 && isArtistDeleteBlockingReason(reason)) {
    const clause = artistDeleteBlockerClause(reason, bodyCount(data));
    return {
      reason,
      message: `This artist cannot be deleted: ${clause}. Nothing was changed. ${ARTIST_DELETE_BLOCKING_TAIL[reason]}`,
      retryable: false,
    };
  }

  if (status === 404) {
    return { reason: "not_found", message: ARTIST_DELETE_GONE_MESSAGE, retryable: false };
  }

  return artistDeleteAnsweredWithoutWriting(err)
    ? { reason: "unknown", message: ARTIST_DELETE_FALLBACK_MESSAGE, retryable: false }
    : indeterminate;
}
