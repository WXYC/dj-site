"use client";

import { useEffect } from "react";
import { Box, Button, Stack, Typography } from "@mui/joy";
import { safeCaptureException } from "@/lib/posthog";

// error.tsx does not wrap this segment's own layout.tsx (requireAuth()'s
// await lives there and still falls through to app/global-error.tsx), only
// page.js/nested layout.js below it. Below this layout are the @classic and
// @modern slots; @modern has its own error.tsx (app/dashboard/@modern/error.tsx)
// so page errors there keep the Leftbar/Rightbar chrome mounted, since that
// chrome lives in @modern's own layout.tsx, not in `children`. @classic has
// no chrome-preserving layout (its chrome is co-located in each page and is
// torn down with it), so this outer boundary is what catches its page errors
// without clearing the root <html> shell.
export default function DashboardError({
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
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100%",
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
