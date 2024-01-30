import { Rotation } from "@/lib/redux";
import { ColorPaletteProp } from "@mui/joy";

export const rotationStyles : { [id in Rotation] : ColorPaletteProp } = {
    'H': 'primary',
    'M': 'neutral',
    'L': 'success',
    'S': 'warning',
};