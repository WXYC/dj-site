"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { safeCapture } from "@/lib/posthog";

/**
 * Records when the server-side `requireAuth()` gate bounced a user back to
 * `/login`. The three `requireAuth` exits append a `bounced=<reason>` query
 * param (`no-session` | `email-not-verified` | `incomplete`); this component
 * reads it and emits a single `login_server_bounce` PostHog event.
 *
 * This is the missing half of the login funnel. `login_post_redirect` (emitted
 * in authenticationHooks) records the client's INTENT to send a DJ to the
 * dashboard after a successful sign-in. `login_server_bounce` records the
 * server's VERDICT — so a DJ who sees "login successful" but lands back on the
 * login page (cookie not valid server-side) finally shows up in telemetry
 * instead of looking "fixed". The `bounced` param is set only by the server,
 * so this never fires for the client's own onboarding redirect.
 *
 * Renders nothing. Mounted once in the shared login layout, so it covers both
 * the classic and modern experiences.
 */
export default function LoginBounceTelemetry(): null {
  const searchParams = useSearchParams();
  const reason = searchParams?.get("bounced") ?? null;
  // Track the last reason we reported so re-renders (and a future second bounce
  // with a different reason) emit correctly without double-counting.
  const lastEmitted = useRef<string | null>(null);

  useEffect(() => {
    if (!reason || reason === lastEmitted.current) {
      return;
    }
    lastEmitted.current = reason;
    safeCapture("login_server_bounce", { reason });
  }, [reason]);

  return null;
}
