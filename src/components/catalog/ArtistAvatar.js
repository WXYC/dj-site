import { Avatar, Stack, Typography } from "@mui/joy"
import React from "react"

const GENRE_COLORS = {
    'Rock': 'primary',
    'Electronic': 'warning',
    'Hiphop': 'info',
    'Jazz': 'success',
    'Classical': 'error'
}

/**
 * @component
 * @category Card Catalog
 * @example
 * // Usage example:
 * import { ArtistAvatar } from './ArtistAvatar';
 *
 * function SongEntry() {
 *   const artist = {
 *     genre: 'Rock',
 *     numbercode: '123',
 *     lettercode: 'R',
 *     entry: 'Artist Name',
 *   };
 *
 *   return (
 *     <ArtistAvatar artist={artist} variant="solid" />
 *   );
 * }
 *
 * @param {Object} props - The component props.
 * @param {Object} props.artist - The artist information.
 * @param {string} props.artist.genre - The genre of the artist.
 * @param {string} props.artist.numbercode - The number code associated with the artist.
 * @param {string} props.artist.lettercode - The letter code associated with the artist.
 * @param {string} props.artist.entry - The entry associated with the artist.
 * @param {string} [props.variant='solid'] - The variant of the avatar (solid or outlined).
 *
 * @returns {JSX.Element} The rendered ArtistAvatar component.
 *
 * @description
 * The ArtistAvatar component renders a circular avatar for a song entry in the catalog in the shape of a record. It displays the letter code in the center and other information around the edge.
 *
 * The `props.artist` object should contain the following properties:
 * - `genre` (string): The genre of the artist.
 * - `numbercode` (string): The number code associated with the artist.
 * - `lettercode` (string): The letter code associated with the artist.
 * - `entry` (string): The entry associated with the artist.
 *
 * The optional `props.variant` property determines the variant of the avatar and can be either `'solid'` (default) or `'outlined'`.
 *
 * The genre of the artist is used to determine the color of the avatar, based on the predefined `GENRE_COLORS` object.
 *
 *
 * @example
 * // Usage example:
 * import { Avatar, Stack, Typography } from '@mui/joy';
 * import React from 'react';
 *
 * const GENRE_COLORS = {
 *   'Rock': 'primary',
 *   'Electronic': 'warning',
 *   'Hiphop': 'info',
 *   'Jazz': 'success',
 *   'Classical': 'error',
 * };
 *
 * export const ArtistAvatar = (props) => {
 *   let colorChoice = GENRE_COLORS[props.artist.genre] || 'neutral';
 *
 *   return (
 *     <Avatar variant={props.variant ?? 'solid'} color={colorChoice}>
 *       <Stack direction="column" sx={{ textAlign: 'center', py: 0.2 }}>
 *         <Typography level="body5" color="white">
 *           {props.artist.numbercode}
 *         </Typography>
 *         <Avatar variant="solid" color="neutral" sx={{ width: '1.1rem', height: '1.1rem', m: 0, fontSize: '0.8rem' }}>
 *           {props.artist.lettercode}
 *         </Avatar>
 *         <Typography level="body5" color="white">
 *           {props.artist.entry}
 *         </Typography>
 *       </Stack>
 *     </Avatar>
 *   );
 * }
 */
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
                    fontSize: '0.8rem',
                    bgColor: props.background
                }}
                >{props.artist.lettercode}</Avatar>
            <Typography level="body5" color="white">
            {props.artist.entry}
            </Typography>
            </Stack>
        </Avatar>
    )
}