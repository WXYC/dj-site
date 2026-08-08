import type { Middleware } from "@reduxjs/toolkit";
import { isRejectedWithValue } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { safeCaptureException } from "./posthog";

/**
 * True when the middleware below will have said nothing about this rejection,
 * so a caller's own `catch` is the only place a message can come from.
 *
 * Two shapes qualify. An HTTP error response (fetchBaseQuery's numeric
 * `status`) whose body carries no `message`: the middleware only re-toasts
 * `data.message`, and a numeric-status rejection has no top-level `error`
 * string to fall through to either. And any rejection payload with no
 * `status` key at all: every other branch below keys off `status`
 * (`FETCH_ERROR`, `TIMEOUT_ERROR`) or a top-level `error` string, so a
 * payload lacking `status` never matches any of them. That covers a
 * `SerializedError` — what `.unwrap()` throws when a `transformResponse`
 * throws or the request aborts — as well as a `fakeBaseQuery` rejection such
 * as `adminApi`'s (`{ message }`, no `status`): that one *is*
 * `isRejectedWithValue` and does reach the middleware below, it just carries
 * nothing the middleware reads (`payload.data.message`, not a top-level
 * `payload.message`). Either way, without a caller speaking up the failure is
 * completely silent.
 *
 * Every string `status` is excluded on purpose: `FETCH_ERROR`,
 * `TIMEOUT_ERROR` and the rest are already answered with a plain-language
 * line, and stacking a vaguer message on top of one adds noise rather than
 * information. A server-supplied `data.message` is excluded for the stronger
 * reason that a second, vaguer toast would bury it.
 */
export function isUnmessagedHttpError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("status" in err)) return true;
  const { status, data } = err as { status?: unknown; data?: unknown };
  if (typeof status !== "number") return false;
  const message =
    data && typeof data === "object" ? (data as { message?: unknown }).message : undefined;
  return !(typeof message === "string" && message.trim().length > 0);
}

// Shared by every store variant so a rejected RTK Query surfaces the same
// toast + telemetry regardless of which scoped store dispatched it. Lives in
// its own module (not the full store's) so smaller stores can reuse it without
// pulling the full slice graph into their bundle.
export const rtkQueryErrorLogger: Middleware =
  () => (next) => (action) => {
    if (isRejectedWithValue(action)) {
      const payload = action.payload as {
        data?: { message?: string };
        status?: string;
        error?: string;
      };

      const endpointName = (action as any)?.meta?.arg?.endpointName;

      safeCaptureException(
        new Error(
          payload?.data?.message || payload?.error || "RTK Query error"
        ),
        {
          endpoint: endpointName,
          status: payload?.status,
        }
      );

      const serverMessage = payload?.data?.message;
      if (serverMessage && serverMessage.trim().length > 0) {
        toast.error(serverMessage);
      } else if (payload?.status === "FETCH_ERROR") {
        toast.error("Network error — please check your connection.");
      } else if (payload?.status === "TIMEOUT_ERROR") {
        toast.error("Request timed out — please try again.");
      } else if (payload?.error && typeof payload.error === "string") {
        toast.error(payload.error);
      }
    }

    return next(action);
  };
