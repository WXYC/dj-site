import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { backendWriteErrorMessage } from "@/lib/backend-error-message";
import { isRefusal, unwrapEndpointError } from "@/lib/rtk-endpoint-error";

type WrappedRotationWriteError = { rotationWriteError: FetchBaseQueryError };

/**
 * Nests a rotation write's rejection under a key the shared rejected-query
 * middleware's `payload.data.message` lookup does not recognize. Every refusal
 * from these routes is rendered inline by the screen that made the write, and
 * the middleware would otherwise toast the identical sentence over the top of
 * it, reporting one refusal twice.
 */
export function wrapRotationWriteError(response: FetchBaseQueryError): WrappedRotationWriteError {
  return { rotationWriteError: response };
}

/**
 * `.unwrap()` throws the wrapper above verbatim, so the server's own message is
 * one level down. An unwrapped rejection is passed to `backendWriteErrorMessage`
 * verbatim rather than through `unwrapEndpointErrorOrRaw`: the shared write
 * path rejects with a bare string when no DJ is signed in, and narrowing that
 * to an object would drop it into the generic fallback instead of
 * `backendWriteErrorMessage`'s own string branch.
 */
export function rotationWriteErrorMessage(err: unknown, fallback: string): string {
  const isWrapped = !!err && typeof err === "object" && "rotationWriteError" in err;
  return backendWriteErrorMessage(
    isWrapped ? unwrapEndpointError("rotationWriteError", err) : err,
    fallback,
  );
}

/** This screen's own line for a refused legacy move; the server's `message` is never shown for it. */
export const ROTATION_MOVE_NOT_ELIGIBLE_MESSAGE =
  "This entry can't be moved here. It may already be linked to a release, it may have been taken out of rotation or moved already, or it may have been added after reviews moved into the DJ site. Reload the list to see where it stands now.";

/** Whether a free-text add's rejection is the 409 `rotation_not_eligible` refusal of a move. */
export function isRotationMoveNotEligible(err: unknown): boolean {
  return isRefusal(err, { status: 409, reasons: ["rotation_not_eligible"], key: "rotationWriteError" });
}
