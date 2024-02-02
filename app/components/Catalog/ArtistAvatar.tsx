import { Avatar, Badge, ColorPaletteProp, Stack, Tooltip, Typography, VariantProp } from "@mui/joy";
import { rotationStyles } from "@/app/styles/rotation/RotationStyles";
import { Artist, Format, Genre, Rotation } from "@/lib/redux";

interface ArtistAvatarProps {
    artist: Artist;
    entry: number;
    background?: string;
    rotation?: Rotation;
    format?: Format
}

const GENRE_COLORS: { [id in Genre]: ColorPaletteProp } = {
    'Rock': 'primary',
    'Blues': 'success',
    'Electronic': 'warning',
    'Hiphop': 'neutral',
    'Jazz': 'success',
    'Classical': 'primary',
    'Reggae': 'warning',
    'Soundtracks': 'neutral',
    'OCS': 'success',
    'Unknown': 'neutral',
}

const GENRE_VARIANTS: { [id in Genre]: VariantProp; } = {
    'Rock': 'solid',
    'Electronic': 'solid',
    'Hiphop': 'solid',
    'Jazz': 'solid',
    'Blues': 'soft',
    'Classical': 'soft',
    'Reggae': 'soft',
    'Soundtracks': 'soft',
    'OCS': 'soft',
    'Unknown': 'soft',
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
 */
export const ArtistAvatar = (props: ArtistAvatarProps): JSX.Element => {

    let color_choice = GENRE_COLORS[props.artist.genre];
    if (color_choice === undefined) {
        color_choice = 'neutral';
    }

    let variant_choice = GENRE_VARIANTS[props.artist.genre];
    if (variant_choice === undefined) {
        variant_choice = 'solid';
    }

    return (
        <Tooltip title={`${props.artist.genre} ${props.format}   ♪   ${props.artist.lettercode} ${props.artist.numbercode}/${props.entry}`} placement="top">
        <Badge
            badgeContent={props.rotation ?? null}
            color={props.rotation && rotationStyles[props.rotation]}
            sx = {{
                width: '3.2rem',
                height: '3.2rem',
                fontSize: '0.2rem',
            }}
        >
        <Avatar
            variant={variant_choice}
            color = {color_choice}
            sx = {{
                width: '3.2rem',
                height: '3.2rem',
            }}
        >
            <Stack direction="row" spacing={0.2} sx = {{ ml: -0.1 }}>
            <Stack direction="column"
                sx = {{
                    justifyContent: 'center',
                }}
            >
            <Typography level="body-xs"
                sx = {{
                    color: "white",
                    width: 9.45,
                    fontSize: '0.6rem',
                }}
            >
            {props.artist.genre.substring(0, 2).toUpperCase()}
            </Typography>
            </Stack>
            <Stack direction="column"
                sx = {{
                    textAlign: 'center',
                }}
            >
            <Typography level="body-xs" sx = {{ color: "white",
                    fontSize: '0.6rem' }} >
            {props.artist.numbercode}
            </Typography>
            <Avatar
                variant={variant_choice == 'solid' ? 'soft' : 'solid'}
                color={(props.format ?? '') == 'CD' ? 'primary' : 'warning'}
                sx = {{
                    width: '1.4rem',
                    height: '1.4rem',
                    m: 0,
                    fontSize: '0.8rem',
                    bgColor: props.background
                }}
                >{props.artist.lettercode}</Avatar>
            <Typography level="body-xs" sx = {{ color: "white",
                    fontSize: '0.6rem', }}>
            {props.entry}
            </Typography>
            </Stack>
            <Stack direction="column"
                sx = {{
                    width: 9.45,
                    textAlign: 'center',
                    justifyContent: 'center'
                }}
            >
            <Typography level="body-xs"
                sx = {{
                    color: "white",
                    fontSize: '0.6rem',
                }}
            >
            {props.format?.substring(0, 2).toUpperCase() ?? ''}
            </Typography>
            </Stack>
            </Stack>
        </Avatar>
        </Badge>
        </Tooltip>
    )
}