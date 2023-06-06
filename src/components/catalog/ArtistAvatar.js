import { Avatar } from "@mui/joy"
import React from "react"

const GENRE_COLORS = {
    'Rock': 'primary',
    'Electronic': 'warning',
    'Hiphop': 'info',
    'Jazz': 'success',
    'Classical': 'error',
}

export const ArtistAvatar = (props) => {

    let color_choice = GENRE_COLORS[props.artist.genre];
    if (color_choice === undefined) {
        color_choice = 'neutral';
    }

    return (
        <Avatar
            variant={props.variant ?? 'solid'}
            color = {color_choice}
        >
            {props.artist.lettercode}{props.artist.numbercode}
        </Avatar>
    )
}