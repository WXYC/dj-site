import { Box, Typography } from "@mui/joy";
import type { AlbumEntry } from "@/lib/features/catalog/types";

/**
 * A small album-art thumbnail for a result row. Uses the entry's resolved
 * `artwork_url` when present (library/search rows carry one); otherwise a
 * tasteful gradient placeholder stamped with the artist's lettercode — no
 * per-row network lookup (the selected-match row may fetch art lazily). Modeled
 * on the catalog result thumbnail + the sandbox placeholder.
 */
export default function AlbumArtThumb({
  entry,
  selected = false,
  size = 42,
}: {
  entry: Pick<AlbumEntry, "artwork_url" | "title" | "artist">;
  selected?: boolean;
  size?: number;
}) {
  const label = entry.artist?.lettercode ?? "";

  if (entry.artwork_url) {
    return (
      <Box
        component="img"
        src={entry.artwork_url}
        alt=""
        aria-hidden
        sx={{
          width: size,
          height: size,
          flex: "0 0 auto",
          borderRadius: "md",
          objectFit: "cover",
          border: "1px solid",
          borderColor: selected ? "rgba(255,255,255,0.42)" : "neutral.outlinedBorder",
        }}
      />
    );
  }

  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: "md",
        overflow: "hidden",
        position: "relative",
        border: "1px solid",
        borderColor: selected ? "rgba(255,255,255,0.42)" : "neutral.outlinedBorder",
        background:
          "linear-gradient(135deg, rgba(125,125,140,0.28), rgba(125,125,140,0.05) 45%, rgba(180,90,120,0.30))",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 6,
          borderRadius: "50%",
          border: "1px solid",
          borderColor: "rgba(255,255,255,0.22)",
        }}
      />
      <Typography
        level="body-xs"
        sx={{
          position: "absolute",
          left: 6,
          bottom: 4,
          fontSize: "0.62rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: selected ? "common.white" : "text.secondary",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
