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

/**
 * The body's `reason` -- the flat legacy discriminant a handler writes
 * straight onto the response (`res.status(409).json({ message, reason,
 * ... })`) -- or `undefined` for anything that isn't a string.
 */
export function bodyReason(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const reason = (data as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
}

/**
 * The body's `code` -- the discriminant `WxycError.toApiErrorResponse()`
 * projects from its `{ code, details }` options, and the one
 * `wxyc-shared/api.yaml`'s `ApiErrorResponse` actually declares -- or
 * `undefined` for anything that isn't a string. `bodyCode` never falls back
 * to `bodyReason` or vice versa: which key a body carries is a fact about
 * which handler answered, and a caller that needs to branch on that drift
 * must see it. A future Backend change is expected to collapse the two
 * conventions into one; until then, use whichever reader matches the
 * endpoint's convention.
 */
export function bodyCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Whether `err` is a refused write: a rejection with `status` whose body
 * `reason` is one of `reasons`. Reads wrapped (`{ [key]: rejection }`) and raw
 * rejections alike, so a predicate does not depend on whether the endpoint's
 * `transformErrorResponse` nests or strips. Anything else -- a different
 * status or reason, a `FETCH_ERROR`, an `Error`, a nest under another key --
 * is `false`.
 */
export function isRefusal(
  err: unknown,
  { status, reasons, key }: { status: number; reasons: readonly string[]; key: string },
): boolean {
  const inner = unwrapEndpointErrorOrRaw(key, err);
  const reason = bodyReason(inner?.data);
  return inner?.status === status && reason !== undefined && reasons.includes(reason);
}

/**
 * Whether `err` carries `status` under `key`, whatever its body holds: it matches on status and key only and never looks at `reason`, so a response with that status that does carry a reason matches too. It exists for refusals whose body carries no `reason`, which `isRefusal` can never match. Reads the wrapped shape only: a raw, unwrapped rejection is `false`. Matching on status alone is only sound where no other response with that status can reach the call site, so a caller is responsible for saying, at its own definition, why that holds.
 */
export function isStatusRefusal(
  err: unknown,
  { status, key }: { status: number; key: string },
): boolean {
  return unwrapEndpointError(key, err)?.status === status;
}
