import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

/**
 * Why `DELETE /library/:id` did not delete. `unknown` is every shape this
 * module refuses to interpret — a 5xx, a non-JSON body, a network failure, a
 * `reason` it has never heard of, or a `409` it does not classify (the delete
 * no longer refuses on flowsheet plays; a still-live 409 is a refusal this
 * module was not written to name) — and is deliberately not folded into
 * `indeterminate`: "the server said no" and "we could not tell what the
 * server said" must not read alike on a screen whose next action is
 * irreversible.
 */
export type ReleaseDeleteRefusalReason =
  | "lock_unavailable"
  | "not_found"
  | "indeterminate"
  | "unknown";

export type ReleaseDeleteRefusal = {
  reason: ReleaseDeleteRefusalReason;
  /** The sentence to put in front of the librarian. Never empty. */
  message: string;
  /**
   * True only for the lock stand-down — the one outcome where pressing Delete
   * again is the correct next move. A refusal on the merits and an
   * uninterpretable failure are both false: repeating the first is futile, and
   * repeating the second is guessing.
   */
  retryable: boolean;
};

export const RELEASE_DELETE_LOCK_MESSAGE =
  "Could not delete: the release is being written to right now. Try again in a moment.";

/**
 * A 404 here is very often the second click of a double-submit, so it is
 * worded as the outcome the librarian wanted rather than as an error.
 */
export const RELEASE_DELETE_GONE_MESSAGE =
  "This release is no longer in the catalog. It may already have been deleted.";

/**
 * A refusal the server answered but this module cannot classify. "Nothing was
 * changed" is a claim, and it is only safe here: the server replied below 500,
 * so it reached a handler that declined before writing.
 */
export const RELEASE_DELETE_FALLBACK_MESSAGE =
  "This release could not be deleted, and the reason could not be read. Nothing was changed.";

/**
 * No answer came back at all — a dropped connection, a gateway's HTML 502, a
 * 5xx. The delete may well have committed on a response that never arrived, so
 * this must not claim either outcome. Reloading is the only way to find out,
 * and pressing Delete again is safe: a second attempt on a row that did go
 * through returns 404 and reads as "already gone".
 */
export const RELEASE_DELETE_INDETERMINATE_MESSAGE =
  "This release may or may not have been deleted — no answer came back. Reload before trying again.";

type WrappedDeleteAlbumError = { deleteAlbumError: FetchBaseQueryError };

function isWrappedDeleteAlbumError(err: unknown): err is WrappedDeleteAlbumError {
  return !!err && typeof err === "object" && "deleteAlbumError" in err;
}

/**
 * The server's `message` when it sent a usable one. A blank or non-string
 * message is treated as absent rather than rendered: an empty refusal banner
 * on a delete screen reads as "nothing happened", which is the one thing a
 * refusal must never look like.
 */
function serverMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const message = (data as { message?: unknown }).message;
  if (typeof message !== "string") return undefined;
  return message.trim() === "" ? undefined : message;
}

function bodyReason(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const reason = (data as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
}

/**
 * Interprets a rejected `deleteAlbum` into something a librarian can act on.
 *
 * Only the lock stand-down (503) prefers the server's own sentence, with a
 * fallback for when it sends none — what a locked row is waiting on is detail
 * this module has no way to reconstruct client-side. Every other named
 * outcome is client-owned wording, the house convention set by
 * `resolveArtistByCodeErrorReason`: the 404 deliberately ignores the server's
 * generic "Album not found" for a sentence specific to this screen, and
 * anything this module does not recognize — a 409 (the delete no longer
 * refuses on flowsheet plays, but can still refuse on other grounds this
 * module was not written to name), an unfamiliar `reason`, an unparseable
 * body below 500 — degrades to one honest fallback rather than rendering
 * server text this module has not vetted.
 */
/**
 * True when the server answered the delete without writing — the only state in
 * which "nothing was changed" is a safe thing to say, or to assume when
 * deciding whether cached lists still hold a row.
 *
 * Accepts either shape a rejection can arrive in. RTK types the `error` passed
 * to `invalidatesTags` as an untransformed `FetchBaseQueryError`, but
 * `transformErrorResponse` has already run by then, so at runtime the status is
 * one level down. Reading only the declared shape finds `undefined` and treats
 * every refusal as a possible write.
 *
 * A sub-500 answer reached a handler that declined before writing. Anything
 * else — a 5xx, a dropped connection, an unparseable body — leaves the outcome
 * genuinely unknown, and this returns false so callers take the cautious path.
 */
export function deleteAnsweredWithoutWriting(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const inner = isWrappedDeleteAlbumError(err) ? err.deleteAlbumError : err;
  const status = (inner as { status?: unknown }).status;
  return typeof status === "number" && status < 500;
}

export function interpretReleaseDeleteError(err: unknown): ReleaseDeleteRefusal {
  const indeterminate: ReleaseDeleteRefusal = {
    reason: "indeterminate",
    message: RELEASE_DELETE_INDETERMINATE_MESSAGE,
    retryable: true,
  };

  // An unwrapped rejection never reached this endpoint's transform, so nothing
  // is known about whether the request was even sent.
  if (!isWrappedDeleteAlbumError(err)) return indeterminate;
  const { status, data } = err.deleteAlbumError;

  const unclassified: ReleaseDeleteRefusal = deleteAnsweredWithoutWriting(err)
    ? { reason: "unknown", message: RELEASE_DELETE_FALLBACK_MESSAGE, retryable: false }
    : indeterminate;

  // Status and `reason` must agree. Either alone is weaker than it looks: a
  // proxy can return a bare 503 with no body at all, and a `reason` on the
  // wrong status is not a shape this endpoint produces.
  if (status === 503 && bodyReason(data) === "lock_unavailable") {
    return {
      reason: "lock_unavailable",
      message: serverMessage(data) ?? RELEASE_DELETE_LOCK_MESSAGE,
      retryable: true,
    };
  }

  if (status === 404) {
    // The server's own "Album not found" is not used: it is the generic
    // error-handler sentence, and this screen knows the specific thing it
    // means here.
    return { reason: "not_found", message: RELEASE_DELETE_GONE_MESSAGE, retryable: false };
  }

  return unclassified;
}
