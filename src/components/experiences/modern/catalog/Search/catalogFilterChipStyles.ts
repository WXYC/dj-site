import type { VariantProp } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import {
  formatTone,
  genreTone,
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

export type CatalogFilterTagChipProps = {
  color?: FormatTone["color"];
  variant?: VariantProp;
  sx?: SxProps;
};

/** Matches catalog result genre chips — same resolver, so the two cannot drift. */
export function getGenreFilterChipProps(genreName: string): CatalogFilterTagChipProps {
  return genreTone(genreName);
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
