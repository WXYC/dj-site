"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/joy";
import { safeCapture } from "@/lib/posthog";

/**
 * Renders in place of the entire dashboard subtree — the layout returns this
 * instead of `props.classic` / `props.modern` / `props.information`, so none
 * of those slots (and none of the `requireAuth()` gates inside them) ever
 * render — when the server could not determine whether the DJ has a valid
 * session: a rate limit, an upstream 5xx, or a transport failure reading the
 * session endpoint. The cookie may still be perfectly valid, so this does
 * NOT redirect to `/login`; doing so would sign a DJ out mid-show for a
 * transient network problem, which is the exact harm this component exists
 * to avoid. The "Sign in again" link is a deliberate escape hatch for the
 * case where that classification is ever wrong about the failure being
 * transient — without it, a misclassified permanent auth failure would trap
 * the DJ on a screen with no navigation.
 *
 * Deliberately reads no Redux state — only `useRouter` and `safeCapture`.
 * This renders before `StoreProvider` mounts (see app/dashboard/layout.tsx),
 * so in production only the app-wide public store is available; a component
 * reading a dashboard-only slice would resolve `undefined` (or throw, for an
 * RTK Query hook) on the real route. `renderWithProviders` seeds the full
 * dashboard store for every test, so that failure mode would not show up
 * there — keep the restriction even though nothing in a test would catch
 * its absence.
 *
 * Emits a `session_unavailable` PostHog event once per mount, with the
 * classified HTTP status (when known) as a property, so the next occurrence
 * of this failure is queryable instead of only inferable from a logout.
 * Guarded by a `useRef` (matching `LoginBounceTelemetry` /
 * `SessionEndedNotice`) so React's development-mode double-invoke, or any
 * re-render, can't double-count it.
 */
export default function SessionUnavailable({
  status,
}: {
  status?: number;
}) {
  const router = useRouter();
  const emitted = useRef(false);

  useEffect(() => {
    if (emitted.current) return;
    emitted.current = true;
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
          Your session hasn&apos;t ended — WXYC&apos;s server is temporarily
          unreachable. Try again in a moment.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="solid" onClick={() => router.refresh()}>
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
