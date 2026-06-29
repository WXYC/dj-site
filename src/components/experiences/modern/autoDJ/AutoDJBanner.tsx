"use client";
/**
 * "Auto DJ Enabled" banner shown at the top of the flowsheet page while auto-DJ
 * is on the air. Uses a solid Sheet so it stays legible even though the shell is
 * greyscaled (see AutoDJGreyscale).
 */
import { Sheet, Typography } from "@mui/joy";
import { useAutoDJStatus } from "@/lib/features/autoDJ/hooks";

export default function AutoDJBanner() {
  const status = useAutoDJStatus();
  if (!status?.active) return null;

  const track = status.currentTrack;
  return (
    <Sheet
      role="status"
      aria-live="polite"
      variant="solid"
      color="warning"
      sx={{
        mb: 1,
        px: 2,
        py: 1,
        borderRadius: "sm",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        flexWrap: "wrap",
      }}
    >
      <Typography level="title-md" sx={{ color: "inherit", fontWeight: "lg" }}>
        Auto DJ Enabled
      </Typography>
      {track ? (
        <Typography level="body-sm" sx={{ color: "inherit", opacity: 0.9 }}>
          {track.artist}
          {track.title ? ` — ${track.title}` : ""}
        </Typography>
      ) : null}
    </Sheet>
  );
}
