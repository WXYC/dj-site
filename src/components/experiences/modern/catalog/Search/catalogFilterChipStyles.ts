import type { Format, Genre } from "@/lib/features/catalog/types";
import type { VariantProp } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import {
  FORMAT_TONES,
  GENRE_TONES,
  ROTATION_TONES,
  type FormatTone,
} from "@/lib/features/experiences/modern/tokens/roles";
import type { Rotation } from "@/lib/features/rotation/types";
import {
  EXCLUSIVES_PURPLE,
  EXCLUSIVES_PURPLE_HOVER,
  filterControlFontSx,
} from "./catalogFilterStyles";
import { isCatalogRotationTag } from "./catalogTagFilters";

const GENRE_KEYS: Genre[] = [
  "Rock",
  "Blues",
  "Electronic",
  "Hiphop",
  "Jazz",
  "Classical",
  "Reggae",
  "Soundtracks",
  "OCS",
  "Unknown",
];

/** Map API `genre_name` to the `Genre` union used for palette lookup. */
export function genreNameToGenreKey(name: string): Genre {
  const trimmed = name.trim();
  if (!trimmed) return "Unknown";
  const hit = GENRE_KEYS.find((k) => k.toLowerCase() === trimmed.toLowerCase());
  return hit ?? "Unknown";
}

export type CatalogFilterTagChipProps = {
  color?: FormatTone["color"];
  variant?: VariantProp;
  sx?: SxProps;
};

/** Map an API format name to the `Format` union used for tone lookup. */
export function formatNameToFormatKey(name: string): Format {
  const n = name.toLowerCase();
  if (n.includes("vinyl")) return "Vinyl";
  if (n.includes("cd")) return "CD";
  return "Unknown";
}

/** Matches catalog result genre chips (`Result.tsx`). */
export function getGenreFilterChipProps(genreName: string): CatalogFilterTagChipProps {
  const key = genreNameToGenreKey(genreName);
  return GENRE_TONES[key] ?? GENRE_TONES.Unknown;
}

/** Matches catalog result format chips — dedicated vinyl/CD hues. */
export function getFormatFilterChipProps(formatName: string): CatalogFilterTagChipProps {
  return FORMAT_TONES[formatNameToFormatKey(formatName)];
}

/** Tag filter chips (v1: exclusives uses WXYC exclusive purple). */
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
