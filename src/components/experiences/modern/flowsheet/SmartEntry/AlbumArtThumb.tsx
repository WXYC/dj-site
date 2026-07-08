import { Album as AlbumIcon } from "@mui/icons-material";
import { Avatar, Box } from "@mui/joy";
import type { AlbumEntry, Genre } from "@/lib/features/catalog/types";
import { GENRE_COLORS, GENRE_VARIANTS } from "../../catalog/ArtistAvatar";

/**
 * Album-art thumbnail for a result row, matching the card catalog's treatment:
 * the resolved `artwork_url` when present, otherwise a genre-coloured Avatar
 * with an album icon (no per-row network lookup). Shared shape with
 * catalog Results so the flowsheet and catalog read consistently.
 */
export default function AlbumArtThumb({
  entry,
  size = 42,
}: {
  entry: Pick<AlbumEntry, "artwork_url" | "title" | "artist">;
  size?: number;
}) {
  const genre = (entry.artist?.genre as Genre) ?? "Unknown";
  const color = GENRE_COLORS[genre] ?? "neutral";
  const variant = GENRE_VARIANTS[genre] ?? "soft";

  if (entry.artwork_url) {
    return (
      <Box
        component="img"
        src={entry.artwork_url}
        alt={`${entry.artist?.name ?? ""} - ${entry.title ?? ""}`}
        sx={{
          width: size,
          height: size,
          flex: "0 0 auto",
          borderRadius: "sm",
          objectFit: "cover",
        }}
      />
    );
  }

  return (
    <Avatar
      variant={variant}
      color={color}
      sx={{ width: size, height: size, flex: "0 0 auto", borderRadius: "sm" }}
    >
      <AlbumIcon />
    </Avatar>
  );
}
