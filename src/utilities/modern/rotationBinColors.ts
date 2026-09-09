import { ROTATION_BINS, ROTATION_BIN_LABELS, type Rotation } from "@/lib/features/rotation/types";
import type {
  RotationBinTokens,
  ThemeSchemeInput,
} from "@/lib/features/experiences/modern/themes/types";

/**
 * Rotation bin colors.
 *
 * The bin ordering and display labels are the domain vocabulary, owned by
 * `lib/features/rotation/types` and re-exported here for this module's
 * existing consumers. The per-bin COLORS live in the theme's `rotation`
 * palette slot (`theme.vars.palette.rotation.{heavy,medium,light,singles}.*`,
 * see lib/features/experiences/modern/themes) so they retheme with the color
 * system.
 */

export { ROTATION_BINS, ROTATION_BIN_LABELS };

/** Bin letter -> the theme's `rotation` palette slot. */
export const ROTATION_BIN_PALETTE_SLOT: Record<
  Rotation,
  keyof ThemeSchemeInput["rotation"]
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
