import type { Rotation } from "@/lib/features/rotation/types";
import type { RotationBinTokens } from "@/lib/features/experiences/modern/themes/types";

/**
 * Rotation bin metadata (ids + display labels).
 *
 * The per-bin COLORS live in the theme's `rotation` palette slot
 * (`theme.vars.palette.rotation.{heavy,medium,light,singles}.*`, see
 * lib/features/experiences/modern/themes) so they retheme with the color
 * system.
 */

export const ROTATION_BINS: Rotation[] = ["H", "M", "L", "S"];

export const ROTATION_BIN_LABELS: Record<Rotation, string> = {
  H: "Heavy",
  M: "Medium",
  L: "Light",
  S: "Singles",
};

/** Bin letter -> the theme's `rotation` palette slot. */
export const ROTATION_BIN_PALETTE_SLOT: Record<
  Rotation,
  "heavy" | "medium" | "light" | "singles"
> = {
  H: "heavy",
  M: "medium",
  L: "light",
  S: "singles",
};

export interface RotationBinSurfaceStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
  hoverBackgroundColor: string;
}

/**
 * Resolves a bin's rendered surface (fill, text, border, hover fill) from
 * its already-resolved palette tokens and selection state. Takes the tokens
 * rather than the theme so this stays a plain data transform with no
 * MUI/component dependency.
 */
export function rotationBinSurfaceStyle(
  tokens: RotationBinTokens,
  isSelected: boolean
): RotationBinSurfaceStyle {
  return {
    backgroundColor: isSelected ? tokens.bgSelected : tokens.bg,
    color: isSelected ? tokens.textSelected : tokens.text,
    borderColor: isSelected ? "transparent" : tokens.border,
    hoverBackgroundColor: isSelected ? tokens.bgSelected : tokens.bgHover,
  };
}
