import { Avatar, Badge, ColorPaletteProp, Stack, Tooltip, Typography, VariantProp } from "@mui/joy";
import { rotationStyles } from "@/app/styles/rotation/RotationStyles";
import { Artist, Format, Genre, Rotation } from "@/lib/redux";

interface ArtistAvatarProps {
    artist?: Artist;
    entry?: number;
    background?: string;
    rotation?: Rotation;
    format?: Format
}

const GENRE_COLORS: { [id in Genre]: ColorPaletteProp } = {
    'Rock': 'primary',
    'Blues': 'success',
    'Electronic': 'success',
    'Hiphop': 'primary',
    'Jazz': 'warning',
    'Classical': 'neutral',
    'Reggae': 'warning',
    'Soundtracks': 'neutral',
    'OCS': 'success',
    'Unknown': 'neutral',
}

const GENRE_VARIANTS: { [id in Genre]: VariantProp; } = {
    'Rock': 'solid',
    'Electronic': 'solid',
    'Hiphop': 'soft',
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
 *
 */
export const ArtistAvatar = (props: ArtistAvatarProps): JSX.Element => {

    let color_choice = GENRE_COLORS[props.artist?.genre ?? 'Unknown'];
    if (color_choice === undefined) {
        color_choice = 'neutral';
    }

    let variant_choice = GENRE_VARIANTS[props.artist?.genre ?? 'Unknown'];
    if (variant_choice === undefined) {
        variant_choice = 'solid';
    }

    return (
        <Tooltip variant="outlined" title={`${props.artist?.genre ?? "[Genre]"} ${props.format == "Unknown" ? "[Format]" : props.format ?? "[Format]"}   ♪   ${props.artist?.lettercode ?? "&&"} ${props.artist?.numbercode ?? "##"}/${props.entry ?? "##"}`} placement="top">
        <Badge
            badgeContent={props.rotation ?? null}
            color={props.rotation && rotationStyles[props.rotation]}
            size="sm"
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
                    color: 'text.primary',
                    width: 9.45,
                    fontSize: '0.6rem',
                    ml: -0.1,
                }}
            >
            {props.artist?.genre?.substring(0, 2)?.toUpperCase() ?? "—"}
            </Typography>
            </Stack>
            <Stack direction="column"
                sx = {{
                    textAlign: 'center',
                }}
            >
            <Typography level="body-xs" sx = {{ color: 'text.primary',
                    fontSize: '0.6rem' }} >
            {props.artist?.numbercode ?? "|"}
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
                >{props.artist?.lettercode}</Avatar>
            <Typography level="body-xs" sx = {{ color: 'text.primary',
                    fontSize: '0.6rem', }}>
            {props.entry ?? "|"}
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
                    color: 'text.primary',
                    fontSize: '0.6rem',
                }}
            >
            {props.format == "Unknown" ? "—" : props.format?.substring(0, 2).toUpperCase() ?? "--"}
            </Typography>
            </Stack>
            </Stack>
        </Avatar>
        </Badge>
        </Tooltip>
    )
}