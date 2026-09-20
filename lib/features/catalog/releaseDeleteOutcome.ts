import {
  bodyReason,
  serverMessage,
  unwrapEndpointError,
  unwrapEndpointErrorOrRaw,
} from "@/lib/rtk-endpoint-error";

/**
 * Why `DELETE /library/:id` did not delete. `unknown` is every shape this
 * module refuses to interpret — a 5xx, a non-JSON body, a network failure, or
 * a `reason` it has never heard of — and is deliberately not folded into
 * `indeterminate`: "the server said no" and "we could not tell what the
 * server said" must not read alike on a screen whose next action is
 * irreversible.
 *
 * Every refusal the endpoint can actually raise is named. `digital_assets` is
 * the only one left that refuses on the merits — the flowsheet-plays refusal
 * is gone — and it is named for the reason `unknown` exists at all: falling
 * through to the fallback would tell the librarian the reason could not be
 * read about a reply that states the reason, the count and the asset ids.
 */
export type ReleaseDeleteRefusalReason =
  | "lock_unavailable"
  | "not_found"
  | "digital_assets"
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

/**
 * The audio-archive binding — the one refusal on the merits `DELETE
 * /library/:id` still raises. A `digital_asset` row is evidence that a
 * recording of this release exists in the archive, and it carries no FK for
 * the delete to cascade through, so the release stays until someone unbinds
 * it.
 *
 * Client-owned wording like every other named outcome bar the lock, and the
 * count is the only part of the server's sentence worth repeating: the asset
 * ids it also sends address rows no dj-site screen can open, so printing them
 * would name a thing the librarian cannot act on. What he can act on is
 * knowing the block is the archive and not the catalog, because the next step
 * is a conversation rather than another click.
 */
export function releaseDeleteDigitalAssetsMessage(assetCount: number | undefined): string {
  const count =
    typeof assetCount === "number" && Number.isInteger(assetCount) && assetCount > 0
      ? `${assetCount} ${assetCount === 1 ? "recording" : "recordings"}`
      : "recordings";
  return (
    `This release cannot be deleted: the audio archive has ${count} bound to it. ` +
    `Nothing was changed. The archive binding has to be cleared first.`
  );
}

function bodyAssetCount(data: unknown): number | undefined {
  if (!data || typeof data !== "object") return undefined;
  const count = (data as { asset_count?: unknown }).asset_count;
  return typeof count === "number" ? count : undefined;
}

/**
 * True only when the HTTP status and the body's `reason` both match what's
 * expected. Either alone is weaker than it looks: a proxy can return a bare
 * status with no body at all, and a `reason` on the wrong status is not a
 * shape this endpoint produces.
 */
function statusAndReasonMatch(
  inner: { status?: unknown; data?: unknown } | undefined,
  status: number,
  reason: string,
): boolean {
  return inner?.status === status && bodyReason(inner.data) === reason;
}

/**
 * Interprets a rejected `deleteAlbum` into something a librarian can act on.
 *
 * Only the lock stand-down (503) prefers the server's own sentence, with a
 * fallback for when it sends none — what a locked row is waiting on is detail
 * this module has no way to reconstruct client-side. Every other named
 * outcome is client-owned wording, the house convention set by
 * `resolveArtistByCodeErrorReason`: the 404 deliberately ignores the server's
 * generic "Album not found" for a sentence specific to this screen, and the
 * digital-asset 409 restates only its count.
 *
 * What is left over degrades to one honest fallback rather than rendering
 * server text this module has not vetted. It is not an empty set: a 401 on a
 * lapsed session, a 403 if the role behind this screen changed under the
 * librarian, a 400 on a malformed id, and any refusal named after this file
 * was last read all land there. So the fallback sentence is worded to stay
 * true of a reply nobody here has seen — it reports that the reason was not
 * read, never that there was none. A refusal the endpoint raises *routinely*
 * does not belong in it, which is why the digital-asset 409 was lifted out.
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
  const status = unwrapEndpointErrorOrRaw("deleteAlbumError", err)?.status;
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
  const inner = unwrapEndpointError("deleteAlbumError", err);
  if (!inner) return indeterminate;
  const { status, data } = inner;

  const unclassified: ReleaseDeleteRefusal = deleteAnsweredWithoutWriting(err)
    ? { reason: "unknown", message: RELEASE_DELETE_FALLBACK_MESSAGE, retryable: false }
    : indeterminate;

  // Status and `reason` must agree. Either alone is weaker than it looks: a
  // proxy can return a bare 503 with no body at all, and a `reason` on the
  // wrong status is not a shape this endpoint produces.
  if (statusAndReasonMatch(inner, 503, "lock_unavailable")) {
    return {
      reason: "lock_unavailable",
      message: serverMessage(data) ?? RELEASE_DELETE_LOCK_MESSAGE,
      retryable: true,
    };
  }

  if (statusAndReasonMatch(inner, 409, "digital_asset_references")) {
    return {
      reason: "digital_assets",
      message: releaseDeleteDigitalAssetsMessage(bodyAssetCount(data)),
      retryable: false,
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
