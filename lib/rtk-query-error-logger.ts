import type { Middleware } from "@reduxjs/toolkit";
import { isRejectedWithValue } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { safeCaptureException } from "./posthog";

/**
 * True when a rejection carries no server-supplied `data.message`.
 *
 * `data.message` is the only thing the middleware below re-toasts verbatim, so
 * it is the one shape a caller must stay quiet for: a generic fallback on top
 * of it buries the reason the server gave. Nothing else the middleware emits
 * names the operation that failed. `PARSING_ERROR` — a mutation answered with
 * an HTML body, e.g. Express's default 404 page or a gateway 502 — surfaces
 * only the raw `SyntaxError: Unexpected token '<'` from the JSON parse.
 * `FETCH_ERROR` / `TIMEOUT_ERROR` surface only a generic transport line. An
 * HTTP error whose body carries no message surfaces nothing. A
 * `SerializedError` — what `.unwrap()` throws when a `transformResponse`
 * throws or the request aborts — is not `isRejectedWithValue`, so the
 * middleware never sees it and nothing is toasted at all. A caller whose own
 * toast is the only thing that will name the failure must gate on this.
 */
export function isUnmessagedRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return true;
  const { data } = err as { data?: unknown };
  const message =
    data && typeof data === "object" ? (data as { message?: unknown }).message : undefined;
  return !(typeof message === "string" && message.trim().length > 0);
}

/**
 * True when `err` is an HTTP error response (fetchBaseQuery's numeric
 * `status`) whose body carries no `message`.
 *
 * Deliberately narrower than `isUnmessagedRejection`: false for
 * `PARSING_ERROR`, `FETCH_ERROR`, `TIMEOUT_ERROR` and for a `SerializedError`,
 * none of which carry an HTTP status. Gate on this only where a non-HTTP
 * rejection genuinely needs no local toast; a caller whose fallback is the
 * only message naming the failed operation must gate on
 * `isUnmessagedRejection` instead, or those shapes leave the user with a raw
 * JSON-parse error, a bare transport line, or silence.
 */
export function isUnmessagedHttpError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  if (typeof (err as { status?: unknown }).status !== "number") return false;
  return isUnmessagedRejection(err);
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
