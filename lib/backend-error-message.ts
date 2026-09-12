/**
 * The message to put in front of a user when a Backend-Service write is
 * refused.
 *
 * Backend-Service reports a refused write as an RTK Query error whose
 * `data.message` carries the reason the user can act on ("Show not live", a
 * validation complaint); everything outside that shape — a thrown `Error`, a
 * rejected string, a network failure — has no such reason and falls back.
 * Interpolating the error object directly renders "[object Object]" and
 * strands the user, which is the whole point of unwrapping it here.
 *
 * `fallback` names the action that failed and has no default: this is shared
 * across features, so any default would be some other screen's sentence, and a
 * user told the wrong action failed looks in the wrong place.
 */
export function backendWriteErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "data" in err &&
    err.data &&
    typeof err.data === "object" &&
    "message" in err.data &&
    typeof (err.data as { message: unknown }).message === "string"
  ) {
    return (err.data as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}
