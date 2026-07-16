"use client";

import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";

import { Format, Genre } from "@/lib/features/catalog/types";
import { Rotation } from "@/lib/features/rotation/types";
import {
  formatTone,
  genreTone,
  ROTATION_TONES,
} from "@/lib/features/experiences/modern/tokens/roles";
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
// `format_name as Format`), so normalize only the attested bare lowercase
// values ("cd" -> "CD", "vinyl" -> "Vinyl") and preserve anything that
// already carries casing or punctuation ("CD-R", "LP", "7-inch Single",
// "Unknown") rather than title-case-mangling it.
function formatLabel(format: Format): string {
  if (/^cd$/i.test(format)) return "CD";
  if (/^[a-z]+$/.test(format)) {
    return format.charAt(0).toUpperCase() + format.slice(1);
  }
  return format;
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
  const genreColor = genreTone(genre).color;

  // At most four small pills (genre, format, rotation, exclusive) — they wrap,
  // so there's no overflow to collapse. Format stays visible so the DJ can
  // always see Vinyl vs CD. No stopPropagation: clicking a pill bubbles to
  // open album detail.
  return (
    <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
      <Chip variant="soft" color={genreColor} size="sm" sx={chipSx}>
        {genre}
      </Chip>
      <Chip
        variant="soft"
        color={formatTone(format).color}
        size="sm"
        sx={chipSx}
      >
        {formatLabel(format)}
      </Chip>
      {rotation && (
        <Chip
          variant="solid"
          color={ROTATION_TONES[rotation]?.color ?? "neutral"}
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
