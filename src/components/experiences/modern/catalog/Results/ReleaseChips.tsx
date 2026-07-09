"use client";

import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";

import { Format, Genre } from "@/lib/features/catalog/types";
import { GENRE_COLORS } from "../ArtistAvatar";

// Always soft in the table — GENRE_VARIANTS' solid chips read louder than
// the row's own text and made rows look uneven.
const chipSx = {
  fontSize: "0.7rem",
  fontWeight: 500,
  "--Chip-minHeight": "18px",
} as const;

function formatLabel(format: Format): string {
  if (/^cd$/i.test(format)) return "CD";
  return format.charAt(0).toUpperCase() + format.slice(1).toLowerCase();
}

export function ReleaseChips({
  genre,
  format,
  onStreaming,
}: {
  genre: Genre;
  format: Format;
  onStreaming: boolean | undefined;
}) {
  const genreColor = GENRE_COLORS[genre ?? "Unknown"] ?? "neutral";

  return (
    <Stack
      direction="row"
      gap={0.5}
      flexWrap="wrap"
      sx={{ marginTop: 0.75 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Chip variant="soft" color={genreColor} size="sm" sx={chipSx}>
        {genre}
      </Chip>
      <Chip variant="soft" color="neutral" size="sm" sx={chipSx}>
        {formatLabel(format)}
      </Chip>
      {onStreaming === false && (
        <Chip
          variant="soft"
          size="sm"
          sx={{
            ...chipSx,
            backgroundColor: "#7B2D8E",
            color: "#fff",
            letterSpacing: "0.5px",
          }}
        >
          WXYC EXCLUSIVE
        </Chip>
      )}
    </Stack>
  );
}
