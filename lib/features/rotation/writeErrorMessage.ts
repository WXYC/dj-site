import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { backendWriteErrorMessage } from "@/lib/backend-error-message";

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

/** `.unwrap()` throws the wrapper above verbatim, so the server's own message is one level down. */
export function rotationWriteErrorMessage(err: unknown, fallback: string): string {
  const rejection =
    err && typeof err === "object" && "rotationWriteError" in err
      ? (err as WrappedRotationWriteError).rotationWriteError
      : err;
  return backendWriteErrorMessage(rejection, fallback);
}
