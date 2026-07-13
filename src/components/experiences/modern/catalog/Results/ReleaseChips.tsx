"use client";

import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";

import { Format, Genre } from "@/lib/features/catalog/types";
import { Rotation } from "@/lib/features/rotation/types";
import { getStyleForRotation } from "@/src/utilities/modern/rotationstyles";
import { GENRE_COLORS } from "../ArtistAvatar";
import { EXCLUSIVES_PURPLE } from "../Search/catalogFilterStyles";

// Descriptor pills are tiny caption-scale and quieter than the artist text;
// only operational status (rotation, exclusive) earns stronger color. The
// row must still read well with all pills removed.
const chipSx = {
  fontSize: "0.65rem",
  fontWeight: 500,
  "--Chip-minHeight": "16px",
  "--Chip-paddingInline": "6px",
} as const;

// `Format` is a cast string, not a real closed union (conversions.ts casts
// `format_name as Format`), so only normalize the attested lowercase "cd";
// preserve any other value's casing rather than title-case-mangling it
// (e.g. "CD-R", "LP", "7-inch Single").
function formatLabel(format: Format): string {
  return /^cd$/i.test(format) ? "CD" : format;
}

export function ReleaseChips({
  genre,
  format,
  rotation,
  onStreaming,
}: {
  genre: Genre;
  format: Format;
  rotation?: Rotation;
  onStreaming: boolean | undefined;
}) {
  const genreColor = GENRE_COLORS[genre ?? "Unknown"] ?? "neutral";

  // At most four small pills (genre, format, rotation, exclusive) — they wrap,
  // so there's no overflow to collapse. Format stays visible so the DJ can
  // always see Vinyl vs CD. No stopPropagation: clicking a pill bubbles to the
  // row/card and opens album detail, as it did before the redesign.
  return (
    <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
      <Chip variant="soft" color={genreColor} size="sm" sx={chipSx}>
        {genre}
      </Chip>
      <Chip variant="soft" color="neutral" size="sm" sx={chipSx}>
        {formatLabel(format)}
      </Chip>
      {rotation && (
        <Chip
          variant="solid"
          color={getStyleForRotation(rotation)}
          size="sm"
          sx={chipSx}
          aria-label={`Rotation ${rotation}`}
        >
          {rotation}
        </Chip>
      )}
      {onStreaming === false && (
        <Chip
          variant="soft"
          size="sm"
          sx={{
            ...chipSx,
            backgroundColor: EXCLUSIVES_PURPLE,
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
