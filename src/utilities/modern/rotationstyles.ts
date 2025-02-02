import { Rotation } from "@/lib/features/catalog/types";
import { ColorPaletteProp } from "@mui/joy";

export const RotationStyles: Record<Rotation, ColorPaletteProp> = {
    "H": "primary",
    "M": "neutral",
    "L": "success",
    "S": "warning",
}

export const getStyleForRotation = (rotation: Rotation): ColorPaletteProp | undefined => {
    return RotationStyles[rotation] as ColorPaletteProp ?? undefined;
}