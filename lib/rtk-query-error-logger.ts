import type { Middleware } from "@reduxjs/toolkit";
import { isRejectedWithValue } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { safeCaptureException } from "./sentry";

type RejectionPayload = {
  data?: { message?: unknown };
  status?: unknown;
  error?: unknown;
};

/**
 * The plain-language message the middleware below would toast for this
 * rejection payload, or `undefined` when it has nothing to say. Both the
 * middleware and `isUnmessagedHttpError` read from this one place so the two
 * can never disagree about which shapes the middleware speaks for — the
 * bug that shipped before this existed was exactly that disagreement: the
 * predicate treated "no `status`" as sufficient proof the middleware would
 * stay quiet, but the `error`-string branch below fires independently of
 * `status`, so a `{ error: "…" }` rejection (RTK's own documented
 * `rejectWithValue` shape) was toasted by both the middleware and the
 * caller's fallback.
 */
function friendlyMiddlewareMessage(payload: RejectionPayload): string | undefined {
  const serverMessage =
    payload.data && typeof payload.data === "object" ? payload.data.message : undefined;
  if (typeof serverMessage === "string" && serverMessage.trim().length > 0) {
    return serverMessage;
  }
  if (payload.status === "FETCH_ERROR") {
    return "Network error — please check your connection.";
  }
  if (payload.status === "TIMEOUT_ERROR") {
    return "Request timed out — please try again.";
  }
  // A mutation answered with a body that isn't JSON (a gateway's HTML error
  // page, a route that isn't there) — `fetchBaseQuery`'s numeric `status`
  // never arrives, only this string. Without a dedicated line here this fell
  // through to the raw parser complaint below (`SyntaxError: Unexpected
  // token '<' …`), which is not a message any DJ should have to read.
  if (payload.status === "PARSING_ERROR") {
    return "Server returned an unexpected response — please try again.";
  }
  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }
  return undefined;
}

/**
 * True when the middleware below will have said nothing about this rejection,
 * so a caller's own `catch` is the only place a message can come from.
 *
 * Delegates to the same decision the middleware makes for its own toast
 * (`friendlyMiddlewareMessage`) rather than re-deriving it from `status`
 * alone — `status` is a strong signal (present and numeric with no body
 * `message` is the classic silent HTTP error; absent entirely covers a
 * `SerializedError`, what `.unwrap()` throws when a `transformResponse`
 * throws or the request aborts, as well as a `fakeBaseQuery` rejection such
 * as `adminApi`'s `{ message }` shape), but it is not the whole story: a
 * payload with no `status` can still carry a top-level `error` string, which
 * the middleware toasts unconditionally.
 */
export function isUnmessagedHttpError(err: unknown): boolean {
  if (!err || typeof err !== "object") return true;
  return friendlyMiddlewareMessage(err as RejectionPayload) === undefined;
}

// Shared by every store variant so a rejected RTK Query surfaces the same
// toast + telemetry regardless of which scoped store dispatched it. Lives in
// its own module (not the full store's) so smaller stores can reuse it without
// pulling the full slice graph into their bundle.
export const rtkQueryErrorLogger: Middleware =
  () => (next) => (action) => {
    if (isRejectedWithValue(action)) {
      const payload = action.payload as RejectionPayload;

      const endpointName = (action as any)?.meta?.arg?.endpointName;

      safeCaptureException(
        new Error(
          (typeof payload?.data?.message === "string" ? payload.data.message : undefined) ||
            (typeof payload?.error === "string" ? payload.error : undefined) ||
            "RTK Query error"
        ),
        {
          endpoint: endpointName,
          status: payload?.status,
        }
      );

      const message = friendlyMiddlewareMessage(payload);
      if (message) toast.error(message);
    }

    return next(action);
  };
