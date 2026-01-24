import { RotationBin } from "@wxyc/shared";
import { ColorPaletteProp } from "@mui/joy";

export const RotationStyles: Record<RotationBin, ColorPaletteProp> = {
  H: "primary",
  M: "neutral",
  L: "success",
  S: "warning",
};

export const getStyleForRotation = (
  rotation: RotationBin
): ColorPaletteProp | undefined => {
  return (RotationStyles[rotation] as ColorPaletteProp) ?? undefined;
};
