import {
  bodyReason,
  serverMessage,
  unwrapEndpointError,
  unwrapEndpointErrorOrRaw,
} from "@/lib/rtk-endpoint-error";

/**
 * Why `POST /library/deleted/{batchId}/restore` did not restore, narrowed to
 * the two refusals this screen distinguishes: a stale-listing 409
 * (`unrestorable_kind`) and the reissued-code refusal
 * (`resolution_required`), which stays unresolved here because no resolution
 * UI exists on this screen. `unknown` collapses every other refusal the server
 * answered without writing (already-restored, a missing batch) to one honest
 * "nothing changed" sentence, kept apart from `indeterminate` — a failure
 * that may have written and must not claim otherwise — matching
 * `releaseDeleteOutcome.ts`'s reasoning for the identical split.
 */
export type RestoreRefusalReason =
  | "unrestorable_kind"
  | "resolution_required"
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

export const RESTORE_LOCK_MESSAGE =
  "Could not restore: the catalog is being written to right now. Try again in a moment.";

export const RESTORE_FALLBACK_MESSAGE = "This batch could not be restored. Nothing was changed.";

export const RESTORE_INDETERMINATE_MESSAGE =
  "This batch may or may not have been restored — no answer came back. Reload before trying again.";

/** Same reasoning as `deleteAnsweredWithoutWriting`: a sub-500 answer reached a handler that declined before writing; anything else may have written. */
export function restoreAnsweredWithoutWriting(err: unknown): boolean {
  const status = unwrapEndpointErrorOrRaw("restoreDeletedBatchError", err)?.status;
  return typeof status === "number" && status < 500;
}

/** Interprets a rejected `restoreDeletedBatch` into something a librarian can act on. */
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
      message: serverMessage(data) ?? RESTORE_UNRESTORABLE_KIND_MESSAGE,
      retryable: false,
    };
  }
  if (status === 400 && reason === "resolution_required") {
    return {
      reason: "resolution_required",
      message: serverMessage(data) ?? RESTORE_RESOLUTION_REQUIRED_MESSAGE,
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
