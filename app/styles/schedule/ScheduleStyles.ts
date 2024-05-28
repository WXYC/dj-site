import { ShowType } from "@/lib/redux";
import { ColorPaletteProp } from "@mui/joy";

export const eventColors: { [id in ShowType] : ColorPaletteProp } = {
    'dj-shift': 'neutral',
    'specialty-show': 'success',
    'new-dj-shift' : 'primary',
};

export const eventTypes: { [id in ShowType] : string } = {
    'dj-shift': 'DJ Shift',
    'specialty-show': 'Specialty Show',
    'new-dj-shift' : 'New DJ Shift',
};