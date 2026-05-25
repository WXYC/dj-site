import type { Genre } from "@/lib/features/catalog/types";
import type { ColorPaletteProp, VariantProp } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import { GENRE_COLORS, GENRE_VARIANTS } from "../ArtistAvatar";
import {
  EXCLUSIVES_PURPLE,
  EXCLUSIVES_PURPLE_HOVER,
  filterControlFontSx,
} from "./catalogFilterStyles";

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
  color?: ColorPaletteProp;
  variant?: VariantProp;
  sx?: SxProps;
};

/** Matches catalog result genre chips (`Result.tsx`). */
export function getGenreFilterChipProps(genreName: string): CatalogFilterTagChipProps {
  const key = genreNameToGenreKey(genreName);
  return {
    color: GENRE_COLORS[key] ?? "neutral",
    variant: GENRE_VARIANTS[key] ?? "soft",
  };
}

/** Matches catalog result format chips (`Result.tsx`: vinyl primary, else warning). */
export function getFormatFilterChipProps(formatName: string): CatalogFilterTagChipProps {
  const isVinyl = formatName.toLowerCase().includes("vinyl");
  return {
    color: isVinyl ? "primary" : "warning",
    variant: "soft",
  };
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
  return { color: "neutral", variant: "soft" };
}

export const catalogFilterTagFontSx = filterControlFontSx;
