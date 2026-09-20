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
 * Picking this over `unwrapEndpointError` is a per-caller decision: a caller
 * whose raw shape can be something other than an object or the wrapped
 * rejection (a bare string, for instance) must not reach for this -- it
 * narrows any non-object raw value to `undefined`.
 */
export function unwrapEndpointErrorOrRaw<Key extends string>(
  key: Key,
  err: unknown,
): FetchBaseQueryError | undefined {
  if (err && typeof err === "object" && key in err) {
    return (err as Record<Key, FetchBaseQueryError>)[key];
  }
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
