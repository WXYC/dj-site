import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

/**
 * The rotation row was linked to a library release by something else while
 * this import was in progress. Reached only through the residual race the
 * pre-create staleness check leaves open, and the one refusal whose remedy is
 * a different screen rather than a retry.
 */
export const LINK_ROTATION_ALREADY_LINKED_STATUS = 409;

export const LINK_ROTATION_ROW_GONE_MESSAGE =
  "This rotation release is no longer in the queue, so there is nothing to link the new library release to.";

export const LINK_ROTATION_ALBUM_GONE_MESSAGE =
  "The library release this import created is not in the catalog, so the rotation release could not be linked to it.";

/**
 * A refusal the server answered but this module cannot classify. "Nothing was
 * changed" is a claim, and it is only safe here: the server replied below 500,
 * so it reached a handler that declined before writing.
 */
export const LINK_ROTATION_FALLBACK_MESSAGE =
  "The rotation release could not be linked, and the reason could not be read. Nothing was changed.";

/**
 * No answer came back at all — a dropped connection, a gateway's HTML 502, a
 * 5xx. The link may well have committed on a response that never arrived, so
 * this must not claim either outcome. Trying again is safe: a second attempt
 * on a row that did go through returns the already-linked refusal, which this
 * screen's next state handles.
 */
export const LINK_ROTATION_INDETERMINATE_MESSAGE =
  "The rotation release may or may not have been linked — no answer came back. Reload before trying again.";

type WrappedLinkRotationError = { linkRotationError: FetchBaseQueryError };

function isWrappedLinkRotationError(err: unknown): err is WrappedLinkRotationError {
  return !!err && typeof err === "object" && "linkRotationError" in err;
}

/**
 * The server's `message` when it sent a usable one. A blank or non-string
 * message is treated as absent rather than rendered: an empty banner on a
 * screen whose whole purpose is to explain a half-finished write reads as
 * "nothing happened", which is the one thing it must never look like.
 */
function serverMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const message = (data as { message?: unknown }).message;
  if (typeof message !== "string") return undefined;
  return message.trim() === "" ? undefined : message;
}

function linkStatus(err: unknown): number | string | undefined {
  if (!isWrappedLinkRotationError(err)) return undefined;
  return err.linkRotationError.status;
}

/**
 * True only for the link endpoint's already-linked refusal.
 *
 * Reads the wrapper `linkRotationToAlbum` puts around its rejections, so an
 * unwrapped 409 from anywhere else in the request pipeline cannot be mistaken
 * for one: the caller's response to this predicate is to offer deleting a
 * library release, and that offer must rest on the one refusal that actually
 * means a second release now exists.
 */
export function isRotationAlreadyLinked(err: unknown): boolean {
  return linkStatus(err) === LINK_ROTATION_ALREADY_LINKED_STATUS;
}

/**
 * The sentence to put in front of the librarian when a link failed for a
 * reason other than an existing link.
 *
 * The two 404s share a status and mean different things — the queue entry was
 * deleted underneath the import, or the release it just created is not in the
 * catalog — and only the server's wording tells them apart, so each maps to
 * its own sentence rather than to a shared "not found".
 */
export function linkRotationFailureMessage(err: unknown): string {
  const status = linkStatus(err);
  if (typeof status !== "number" || status >= 500) return LINK_ROTATION_INDETERMINATE_MESSAGE;

  const message = isWrappedLinkRotationError(err)
    ? serverMessage(err.linkRotationError.data)
    : undefined;

  if (status === 404) {
    return message?.toLowerCase().includes("album")
      ? LINK_ROTATION_ALBUM_GONE_MESSAGE
      : LINK_ROTATION_ROW_GONE_MESSAGE;
  }

  return message ?? LINK_ROTATION_FALLBACK_MESSAGE;
}
