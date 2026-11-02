import type { RotationBinColors } from "@/lib/features/experiences/modern/tokens/roles";

/**
 * Selection-state surfaces for bin pickers. A bin's colors themselves come
 * only from `rotationBinColors` in the role tier; this maps them onto a
 * picker's rest/selected/hover states.
 */

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
  tokens: RotationBinColors,
  isSelected: boolean
): RotationBinSurfaceStyle {
  return {
    backgroundColor: isSelected ? tokens.bgSelected : tokens.bg,
    color: isSelected ? tokens.textSelected : tokens.text,
    borderColor: isSelected ? "transparent" : tokens.border,
    hoverBackgroundColor: isSelected ? tokens.bgSelected : tokens.bgHover,
  };
}
