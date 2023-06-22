import { Avatar, Stack, Typography } from "@mui/joy"
import React from "react"

const ROTATION_COLORS = {
    'H': 'primary',
    'M': 'warning',
    'L': 'info',
    'S': 'success',
}

export const RotationAvatar = (props) => {

    let color_choice = ROTATION_COLORS[props.rotation];
    if (color_choice === undefined) {
        color_choice = 'neutral';
    }

    return (
        <Avatar
            variant={props.variant ?? 'solid'}
            color = {color_choice}
        >
            <Typography color="white">
            {props.rotation}
            </Typography>
        </Avatar>
    )
}