import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

/**
 * Unwraps the `{ [key]: FetchBaseQueryError }` nest an endpoint's
 * `transformErrorResponse` puts around its rejection -- the house convention
 * that keeps the shared `rtkQueryErrorLogger` from toasting `data.message` a
 * second time over a screen's own wording. Returns `undefined` for anything
 * that isn't that shape, including an unwrapped rejection: RTK types the
 * error `invalidatesTags`'s function form receives as the untransformed
 * `FetchBaseQueryError`, but `transformErrorResponse` has already run by
 * then, so an unwrapped read finds nothing and a caller must choose
 * `unwrapEndpointErrorOrRaw` if that gap matters to it.
 */
export function unwrapEndpointError<Key extends string>(
  key: Key,
  err: unknown,
): FetchBaseQueryError | undefined {
  if (!err || typeof err !== "object" || !(key in err)) return undefined;
  return (err as Record<Key, FetchBaseQueryError>)[key];
}

/**
 * `unwrapEndpointError`, falling back to `err` itself when it isn't wrapped.
 * For the callers where the wrapped and raw shapes are the same rejection one
 * level apart -- a `.catch` on a call site RTK does not finish transforming
 * before it throws, or a tag-invalidation callback typed against the raw
 * shape -- rather than for callers where only the wrapped shape is ever real.
 * Each caller's choice between the two is a decision already made in the
 * classifier it moved from; keep it, don't default to one.
 */
export function unwrapEndpointErrorOrRaw<Key extends string>(
  key: Key,
  err: unknown,
): FetchBaseQueryError | undefined {
  const wrapped = unwrapEndpointError(key, err);
  if (wrapped) return wrapped;
  return err && typeof err === "object" ? (err as FetchBaseQueryError) : undefined;
}

/**
 * The server's `message` when it sent a usable one. A blank or non-string
 * message is treated as absent rather than rendered: an empty refusal banner
 * reads as "nothing happened", which is the one thing a refusal must never
 * look like.
 */
export function serverMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const message = (data as { message?: unknown }).message;
  if (typeof message !== "string") return undefined;
  return message.trim() === "" ? undefined : message;
}

/** The body's `reason`, or `undefined` for anything that isn't a string. */
export function bodyReason(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const reason = (data as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
}

/**
 * A typed extra off the body -- `asset_count`, `conflicts`, whatever a given
 * refusal carries beyond `message` and `reason` -- read only when it matches
 * the guard passed in, so a wrongly-shaped field degrades to `undefined`
 * rather than being trusted.
 */
export function bodyField<T>(
  data: unknown,
  field: string,
  isField: (value: unknown) => value is T,
): T | undefined {
  if (!data || typeof data !== "object") return undefined;
  const value = (data as Record<string, unknown>)[field];
  return isField(value) ? value : undefined;
}

/**
 * True only when the HTTP status and the body's `reason` both match what's
 * expected. Either alone is weaker than it looks: a proxy can return a bare
 * status with no body at all, and a `reason` on the wrong status is not a
 * shape any handler produces.
 */
export function statusAndReasonMatch(
  inner: { status?: unknown; data?: unknown } | undefined,
  status: number,
  reason: string,
): boolean {
  return inner?.status === status && bodyReason(inner.data) === reason;
}
