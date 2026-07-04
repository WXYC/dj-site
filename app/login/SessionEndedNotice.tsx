"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Shows a neutral, reassuring notice when `requireAuth()` bounced the DJ back to
 * `/login` because the server saw no session (`bounced=no-session`) — the
 * genuine session-expiry / logged-out-navigation case that survives the
 * client-side login race fix. Without this, an expired session dumps the DJ on
 * a bare, error-looking `/login?bounced=no-session` URL with no explanation.
 *
 * Scoped strictly to `no-session`. The other bounce reasons carry their own
 * params (`error=email-not-verified`, `incomplete=true`) that already drive
 * inline messaging / slot routing, so surfacing a toast for them would
 * double-message. Telemetry stays in the sibling `LoginBounceTelemetry`; this
 * component owns only the user-facing message.
 *
 * Renders nothing (the toast is portaled). Mounted once in the shared login
 * layout, so it covers both the classic and modern experiences.
 */
export default function SessionEndedNotice(): null {
  const searchParams = useSearchParams();
  const reason = searchParams?.get("bounced") ?? null;
  // Guard against a re-render firing a second toast for the same bounce.
  const shown = useRef(false);

  useEffect(() => {
    if (reason !== "no-session" || shown.current) {
      return;
    }
    shown.current = true;
    // A stable id dedupes across a fast double-mount (e.g. Strict Mode).
    toast.info("Your session has ended. Please sign in again.", {
      id: "session-ended",
    });
  }, [reason]);

  return null;
}
