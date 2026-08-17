"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/joy";
import { safeCapture } from "@/lib/posthog";

// Sentinel distinct from every real `status` value (including `undefined`,
// the transport-failure case), so the telemetry guard below can tell "never
// emitted" apart from "emitted once already, no status".
const NOT_YET_EMITTED = Symbol("not-yet-emitted");

/**
 * Shown when the server could not determine whether the DJ has a valid
 * session: a rate limit, an upstream 5xx, or a transport failure reading the
 * session endpoint (see app/dashboard/layout.tsx for how this gets rendered
 * in place of the gated slots). The cookie may still be perfectly valid, so
 * this component does NOT redirect to `/login`; doing so would sign a DJ out
 * mid-show for a transient network problem, which is the exact harm this
 * component exists to avoid. The "Sign in again" link is a deliberate escape
 * hatch for the case where that classification is ever wrong about the
 * failure being transient — without it, a misclassified permanent auth
 * failure would trap the DJ on a screen with no navigation.
 *
 * Deliberately reads no Redux state — only `useRouter` and `safeCapture`.
 * This renders before `StoreProvider` mounts (see app/dashboard/layout.tsx),
 * so in production only the app-wide public store is available; a component
 * reading a dashboard-only slice would resolve `undefined` (or throw, for an
 * RTK Query hook) on the real route. Keep the restriction — the test that
 * mounts this under only the public store is what would catch a regression
 * here.
 *
 * Emits a `session_unavailable` PostHog event with the classified HTTP
 * status (when known) as a property, so the next occurrence of this failure
 * is queryable instead of only inferable from a logout — this path no
 * longer redirects, so it is the only trace an outage leaves here. Guarded
 * by a `useRef` keyed on `status`, not a mount-scoped boolean: the retry
 * button calls `router.refresh()` on this same instance rather than
 * remounting it, so a DJ retrying through a continuing outage whose failure
 * mode changes (429 -> 503) must still report the new status. A same-status
 * repeat — including React's development-mode double-invoke — still dedupes,
 * which is what keeps cardinality bounded against the org's PostHog volume
 * constraint.
 */
export default function SessionUnavailable({
  status,
}: {
  status?: number;
}) {
  const router = useRouter();
  // During a continuing outage a refresh resolves to an identical screen, so
  // without a pending state the DJ has no signal the click registered and
  // re-clicks into a service that may already be rate-limiting them.
  const [isPending, startTransition] = useTransition();
  const lastEmittedStatus = useRef<number | undefined | typeof NOT_YET_EMITTED>(NOT_YET_EMITTED);

  useEffect(() => {
    if (lastEmittedStatus.current === status) return;
    lastEmittedStatus.current = status;
    safeCapture("session_unavailable", { status });
  }, [status]);

  return (
    <Box
      component="div"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100%",
      }}
    >
      <Stack
        spacing={2}
        alignItems="center"
        sx={{ textAlign: "center", maxWidth: 480, px: 2 }}
      >
        <Typography level="h3">We couldn&apos;t reach the server</Typography>
        <Typography level="body-md">
          Your session hasn&apos;t ended — WXYC&apos;s server couldn&apos;t
          be reached. Try again, or sign in again if it keeps happening.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="solid"
            loading={isPending}
            onClick={() => startTransition(() => router.refresh())}
          >
            Try again
          </Button>
          <Button component={Link} href="/login" variant="outlined">
            Sign in again
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
