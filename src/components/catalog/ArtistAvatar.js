import { Avatar, Stack, Typography } from "@mui/joy"
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
            <Stack direction="column"
                sx = {{
                    textAlign: 'center',
                    py: 0.2,
                }}
            >
            <Typography level="body5" color="white">
            {props.artist.numbercode}
            </Typography>
            <Avatar
                variant="solid"
                color="neutral"
                sx = {{
                    width: '1.1rem',
                    height: '1.1rem',
                    m: 0,
                    fontSize: '0.8rem'
                }}
                >{props.artist.lettercode}</Avatar>
            <Typography level="body5" color="white">
            {props.artist.entry}
            </Typography>
            </Stack>
        </Avatar>
    )
}