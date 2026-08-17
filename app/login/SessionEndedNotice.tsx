"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Keyed by the `bounced` reason. Both are `requireAuth()` exits with no
// notice surface of their own on `/login`, but they must not share copy:
// `no-session` genuinely means the session is gone. `session-unavailable`
// means the read couldn't be completed (rate limited, upstream 5xx, or a
// transport failure) — the cookie may still be perfectly valid, so telling
// the DJ their session "ended" would be false. See
// `app/dashboard/SessionUnavailable.tsx`, which tells the same honest story
// for the layout-gated path that renders in place instead of bouncing here.
const BOUNCE_NOTICES: Record<string, { message: string; id: string }> = {
  "no-session": {
    message: "Your session has ended. Please sign in again.",
    id: "session-ended",
  },
  "session-unavailable": {
    message:
      "We couldn't confirm your session just now — it may still be valid. Sign in again if this keeps happening.",
    id: "session-unavailable",
  },
};

/**
 * Shows a neutral notice for the two `requireAuth()` bounce reasons that
 * have no inline UI of their own on `/login`: `bounced=no-session` — the
 * genuine session-expiry / logged-out-navigation case that survives the
 * client-side login race fix — and `bounced=session-unavailable` — a
 * page-level `requireAuth()` call whose session read failed to resolve and
 * fell back to a bounce for lack of a notice surface of its own. Without
 * this, either case dumps the DJ on a bare, error-looking
 * `/login?bounced=...` URL with no explanation.
 *
 * The other bounce reasons carry their own params (`error=email-not-verified`,
 * `incomplete=true`) that already drive inline messaging / slot routing, so
 * surfacing a toast for them would double-message. Telemetry stays in the
 * sibling `LoginBounceTelemetry`; this component owns only the user-facing
 * message.
 *
 * Renders nothing (the toast is portaled). Mounted once in the shared login
 * layout, so it covers both the classic and modern experiences.
 */
export default function SessionEndedNotice(): null {
  const searchParams = useSearchParams();
  const reason = searchParams?.get("bounced") ?? null;
  // Guard against a re-render firing a second toast for the same bounce.
  // Tracks the reason itself, not just whether one fired, so a later bounce
  // with a different reason within the same mount still gets its own toast.
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const notice = reason ? BOUNCE_NOTICES[reason] : undefined;
    if (!notice || shown.current === reason) {
      return;
    }
    shown.current = reason;
    // A stable id dedupes across a fast double-mount (e.g. Strict Mode).
    toast.info(notice.message, { id: notice.id });
  }, [reason]);

  return null;
}
