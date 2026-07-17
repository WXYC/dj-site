import type { Middleware } from "@reduxjs/toolkit";
import { isRejectedWithValue } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { safeCaptureException } from "./posthog";

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
