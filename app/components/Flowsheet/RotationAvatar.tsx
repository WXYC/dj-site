import { Rotation } from "@/lib/redux";
import { Avatar, ColorPaletteProp, Typography } from "@mui/joy";

export const ROTATION_COLORS: { [id in Rotation] : ColorPaletteProp } = {
    "H": 'primary',
    "M": 'warning',
    "L": 'neutral',
    "S": 'success',
}

interface RotationAvatarProps {
    rotation: Rotation,
    variant?: 'solid' | 'outlined'
}

/**
 * @component
 * @category Flowsheet
 * @description Displays a rotation avatar
 * 
 * @param {Object} props
 * @param {string} props.rotation Can be 'H', 'M', 'L', or 'S'
 * @param {string} props.variant Can be 'solid' or 'outlined'
 * @returns JSX.Element
 */
export const RotationAvatar = (props: RotationAvatarProps) => {

    let color_choice = ROTATION_COLORS[props.rotation];
    if (color_choice === undefined) {
        color_choice = 'neutral';
    }

    return (
        <Avatar
            variant={props.variant ?? 'solid'}
            color = {color_choice}
        >
            <Typography sx = {{ color: "white" }}>
            {props.rotation}
            </Typography>
        </Avatar>
    )
}