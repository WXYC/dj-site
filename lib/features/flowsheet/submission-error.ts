/**
 * The message to show a DJ when a flowsheet write fails.
 *
 * Backend-Service reports a refused write as an RTK Query error whose
 * `data.message` carries the reason a DJ can act on ("Show not live", a
 * validation complaint); everything outside that shape — a thrown `Error`, a
 * rejected string, a network failure — has no such reason and falls back.
 * Interpolating the error object directly renders "[object Object]" and
 * strands the DJ, which is the whole point of unwrapping it here.
 *
 * `fallback` names the action that failed, for the paths where the default
 * would describe the wrong one — going live is not adding to the flowsheet,
 * and a DJ told otherwise looks in the wrong place.
 */
export function flowsheetWriteErrorMessage(
  err: unknown,
  fallback = "Could not add to flowsheet"
): string {
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
