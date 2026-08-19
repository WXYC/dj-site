import type { VariantProp } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import {
  formatTone,
  GENRE_TONES,
  ROTATION_TONES,
  type FormatTone,
  type GenreToneKey,
} from "@/lib/features/experiences/modern/tokens/roles";
import type { Rotation } from "@/lib/features/rotation/types";
import {
  EXCLUSIVES_PURPLE,
  EXCLUSIVES_PURPLE_HOVER,
  filterControlFontSx,
} from "./catalogFilterStyles";
import { isCatalogRotationTag } from "./catalogTagFilters";

// Read off the tone table rather than restated, so the two can't drift. These
// are the genres with a designed chip color, NOT the genres that exist — that
// list is server-owned and longer.
const GENRE_TONE_KEYS = Object.keys(GENRE_TONES) as GenreToneKey[];

/**
 * Resolve a server genre name to a tone-table key, case-insensitively. A genre
 * with no designed color falls back to the neutral `Unknown` tone; only the
 * chip's color degrades, the filter's label still reads the real genre.
 */
export function genreNameToGenreKey(name: string): GenreToneKey {
  const trimmed = name.trim();
  if (!trimmed) return "Unknown";
  const hit = GENRE_TONE_KEYS.find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  return hit ?? "Unknown";
}

export type CatalogFilterTagChipProps = {
  color?: FormatTone["color"];
  variant?: VariantProp;
  sx?: SxProps;
};

/** Matches catalog result genre chips (`Result.tsx`). */
export function getGenreFilterChipProps(genreName: string): CatalogFilterTagChipProps {
  const key = genreNameToGenreKey(genreName);
  return GENRE_TONES[key] ?? GENRE_TONES.Unknown;
}

/** Matches catalog result format chips — dedicated vinyl/CD hues. */
export function getFormatFilterChipProps(formatName: string): CatalogFilterTagChipProps {
  return formatTone(formatName);
}

/** Tag filter chips (exclusives uses WXYC exclusive purple). */
export function getTagFilterChipProps(tagId: string): CatalogFilterTagChipProps {
  if (tagId === "exclusives") {
    return {
      variant: "soft",
      sx: {
        bgcolor: EXCLUSIVES_PURPLE,
        color: "#fff",
        fontWeight: 600,
        "--Chip-focusedInset": "transparent",
        "--Chip-focusedThickness": "0px",
        "&:hover": {
          bgcolor: EXCLUSIVES_PURPLE_HOVER,
        },
      },
    };
  }
  if (tagId === "missing") {
    return { color: "neutral", variant: "outlined" };
  }
  if (isCatalogRotationTag(tagId)) {
    return {
      color: ROTATION_TONES[tagId as Rotation]?.color ?? "neutral",
      variant: "soft",
    };
  }
  return { color: "neutral", variant: "soft" };
}

export const catalogFilterTagFontSx = filterControlFontSx;
