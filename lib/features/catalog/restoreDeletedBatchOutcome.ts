import {
  bodyReason,
  serverMessage,
  unwrapEndpointError,
  unwrapEndpointErrorOrRaw,
} from "@/lib/rtk-endpoint-error";

/**
 * Why `POST /library/deleted/{batchId}/restore` did not restore. Every refusal
 * the endpoint raises routinely is named: the stale-listing 409
 * (`unrestorable_kind`), the reissued-code refusal (`resolution_required`),
 * which stays unresolved here because no resolution UI exists on this screen,
 * the idempotency 409 (`already_restored`), and the lock stand-down.
 *
 * `already_restored` is named rather than collapsed for the same reason the
 * others are: it is the ordinary second press, not an edge case. No field on
 * the archive listing changes when a restore succeeds, so the row keeps its
 * live Restore button, and a reload followed by a second press is the normal
 * path — as is a double-click or a second tab.
 *
 * `unknown` is what is left: a refusal the server answered below 500 that this
 * module cannot classify (a missing batch, a lapsed session, a reason named
 * after this file was last read). It stays apart from `indeterminate` — a
 * failure that may have written and must not claim otherwise — matching
 * `releaseDeleteOutcome.ts`'s reasoning for the identical split.
 */
export type RestoreRefusalReason =
  | "unrestorable_kind"
  | "resolution_required"
  | "already_restored"
  | "lock_unavailable"
  | "indeterminate"
  | "unknown";

export type RestoreRefusal = {
  reason: RestoreRefusalReason;
  /** The sentence to put in front of the librarian. Never empty. */
  message: string;
  /** True only for the lock stand-down and an indeterminate answer — the two outcomes where pressing Restore again is the right next move. */
  retryable: boolean;
};

/** `restorable: true` on the listing is computed at read time and can go stale before the click. Permanent, matching the server's own wording. */
export const RESTORE_UNRESTORABLE_KIND_MESSAGE =
  "This batch cannot be restored: it holds an entity with no restore plan. This is permanent, not retryable.";

export const RESTORE_RESOLUTION_REQUIRED_MESSAGE =
  "This card's original call code is now held by another release, so it could not be restored automatically. Resolving that conflict isn't available from this screen yet.";

/**
 * Worded as the outcome the librarian wanted rather than as an error, the way
 * `releaseDeleteOutcome.ts` words its 404: the card is in the catalog, which is
 * what he pressed the button for. The server also sends the restored `library`
 * ids; they address rows no screen here can open, so they are dropped.
 */
export const RESTORE_ALREADY_RESTORED_MESSAGE =
  "This batch is already back in the catalog. It may already have been restored.";

export const RESTORE_LOCK_MESSAGE =
  "Could not restore: the catalog is being written to right now. Try again in a moment.";

/**
 * A refusal the server answered but this module cannot classify. It reports
 * that the reason was not read, never that there was none: the set is not
 * empty — a 404 on a batch id that is no longer there, a 401 on a lapsed
 * session, a refusal named after this file was last read — so the sentence has
 * to stay true of a reply nobody here has seen. "Nothing was changed" is safe
 * only because the server replied below 500, having reached a handler that
 * declined before writing.
 */
export const RESTORE_FALLBACK_MESSAGE =
  "This batch could not be restored, and the reason could not be read. Nothing was changed.";

export const RESTORE_INDETERMINATE_MESSAGE =
  "This batch may or may not have been restored — no answer came back. Reload before trying again.";

/** Same reasoning as `deleteAnsweredWithoutWriting`: a sub-500 answer reached a handler that declined before writing; anything else may have written. */
export function restoreAnsweredWithoutWriting(err: unknown): boolean {
  const status = unwrapEndpointErrorOrRaw("restoreDeletedBatchError", err)?.status;
  return typeof status === "number" && status < 500;
}

/**
 * Interprets a rejected `restoreDeletedBatch` into something a librarian can
 * act on.
 *
 * Only the lock stand-down (503) prefers the server's own sentence, with a
 * fallback for when it sends none — what a locked catalog is waiting on is
 * detail this module has no way to reconstruct client-side. Every other named
 * outcome is client-owned wording, the house convention `releaseDeleteOutcome`
 * follows, and the two 400/409 refusals are why it exists: the server's
 * `resolution_required` sentence ends "Re-send with resolution=next_free_code
 * or resolution=decline", an API instruction addressed to a caller, and this
 * is the one screen with no resolution UI to act on it; its `already_restored`
 * sentence ends in `library` ids that address rows nothing here can open.
 */
export function interpretRestoreError(err: unknown): RestoreRefusal {
  const indeterminate: RestoreRefusal = {
    reason: "indeterminate",
    message: RESTORE_INDETERMINATE_MESSAGE,
    retryable: true,
  };

  const inner = unwrapEndpointError("restoreDeletedBatchError", err);
  if (!inner) return indeterminate;
  const { status, data } = inner;
  const reason = bodyReason(data);

  if (status === 409 && reason === "unrestorable_kind") {
    return {
      reason: "unrestorable_kind",
      message: RESTORE_UNRESTORABLE_KIND_MESSAGE,
      retryable: false,
    };
  }
  if (status === 400 && reason === "resolution_required") {
    return {
      reason: "resolution_required",
      message: RESTORE_RESOLUTION_REQUIRED_MESSAGE,
      retryable: false,
    };
  }
  if (status === 409 && reason === "already_restored") {
    return {
      reason: "already_restored",
      message: RESTORE_ALREADY_RESTORED_MESSAGE,
      retryable: false,
    };
  }
  if (status === 503 && reason === "lock_unavailable") {
    return {
      reason: "lock_unavailable",
      message: serverMessage(data) ?? RESTORE_LOCK_MESSAGE,
      retryable: true,
    };
  }

  return restoreAnsweredWithoutWriting(err)
    ? { reason: "unknown", message: RESTORE_FALLBACK_MESSAGE, retryable: false }
    : indeterminate;
}
