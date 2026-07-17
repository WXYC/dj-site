"use client";

import { useEffect } from "react";
import { Box, Button, Stack, Typography } from "@mui/joy";
import { safeCaptureException } from "@/lib/posthog";

// Placed inside the @modern slot (below app/dashboard/@modern/layout.tsx,
// which renders Leftbar/Rightbar/Header directly rather than via `children`)
// so this boundary only replaces the page content, not the chrome around it.
// An error.tsx at app/dashboard/error.tsx would sit above that layout and
// tear the whole thing down instead. See app/dashboard/error.tsx for the
// sibling boundary that covers the @classic slot, which has no chrome layout
// of its own to preserve.
export default function ModernDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    safeCaptureException(error);
  }, [error]);

  return (
    <Box
      component="div"
      sx={{
        display: "flex",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 0,
      }}
    >
      <Stack spacing={2} alignItems="center" sx={{ textAlign: "center" }}>
        <Typography level="h3">Something went wrong</Typography>
        <Button variant="solid" onClick={() => reset()}>
          Try again
        </Button>
      </Stack>
    </Box>
  );
}
