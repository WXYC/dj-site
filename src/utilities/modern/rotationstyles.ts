/**
 * Rotation styles - re-exported from the centralized token system.
 */

export { RotationStyles, getRotationColor } from "@/lib/design-system/tokens";

import { getRotationColor } from "@/lib/design-system/tokens";
import type { RotationBin } from "@wxyc/shared";
import type { ColorPaletteProp } from "@mui/joy";

/** Get the style/color for a rotation bin. */
export const getStyleForRotation = (
  rotation: RotationBin
): ColorPaletteProp | undefined => {
  return getRotationColor(rotation);
};
