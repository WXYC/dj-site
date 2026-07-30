import { cookies } from "next/headers";
import { permanentRedirect } from "next/navigation";
import Link from "next/link";
import { Box, Button, Sheet, Stack, Typography } from "@mui/joy";
import {
  albumSerialPath,
  resolveLegacyReleaseId,
} from "@/lib/features/catalog/legacy-permalink.server";

/**
 * Legacy per-release permalink front door. External callers (LML lookups, the
 * Slack request line, wxyc.info) hold the tubafrenzy legacy release id, not the
 * Backend-Service serial the canonical album route is keyed on. This route
 * resolves the legacy id to the serial and redirects to
 * `/dashboard/album/[serial]`.
 *
 * It renders through the dashboard `@information` slot — the slot the layout
 * actually renders (the `children`-slot sibling is a routability stub whose
 * output is discarded). A cold external paste hits the dashboard `requireAuth()`
 * gate first and bounces through login when unauthenticated.
 *
 * A resolved id 308-redirects: the serial is stable once assigned, so the hop
 * is safe to cache permanently. A miss renders a non-cacheable "not in the
 * catalog yet" state rather than a cacheable redirect, because the legacy id
 * can start resolving once a daily `library.db` sync lands it in
 * Backend-Service Postgres.
 */
export default async function LegacyAlbumInformation({
  params,
}: {
  params: Promise<{ legacyId: string }>;
}) {
  const { legacyId } = await params;
  const cookieHeader = (await cookies()).toString();

  const resolution = await resolveLegacyReleaseId(legacyId, cookieHeader);
  if (resolution.status === "resolved") {
    permanentRedirect(albumSerialPath(resolution.serial));
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "80vh",
        p: 2,
      }}
    >
      <Sheet
        variant="outlined"
        sx={{ maxWidth: 480, width: "100%", borderRadius: "md", p: 4 }}
      >
        <Stack spacing={2} sx={{ textAlign: "center", alignItems: "center" }}>
          <Typography level="h3">Not in the catalog yet</Typography>
          <Typography level="body-md">
            This release isn&apos;t in the WXYC catalog yet. Newly added records
            can take until the next library sync to appear here.
          </Typography>
          <Button component={Link} href="/dashboard/catalog" variant="solid">
            Browse the catalog
          </Button>
        </Stack>
      </Sheet>
    </Box>
  );
}
