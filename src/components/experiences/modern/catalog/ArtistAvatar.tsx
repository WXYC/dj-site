import type { JSX } from "react";
import { ArtistEntry, Format, Genre } from "@/lib/features/catalog/types";
import { Rotation } from "@/lib/features/rotation/types";
import {
  formatTone,
  GENRE_TONES,
  ROTATION_TONES,
} from "@/lib/features/experiences/modern/tokens/roles";
import { Avatar, Badge, Stack, Tooltip, Typography } from "@mui/joy";

interface ArtistAvatarProps {
  artist?: ArtistEntry;
  entry?: number;
  background?: string;
  rotation?: Rotation;
  format?: Format;
}

export const ArtistAvatar = (props: ArtistAvatarProps): JSX.Element => {
  const genreTone =
    GENRE_TONES[(props.artist?.genre as Genre) ?? "Unknown"] ??
    GENRE_TONES.Unknown;
  const color_choice = genreTone.color;
  const variant_choice = genreTone.variant;
  const formatColor = formatTone(props.format).color;

  return (
    <Tooltip
      variant="outlined"
      title={`${props.artist?.genre ?? "[Genre]"} ${
        props.format == "Unknown" ? "[Format]" : props.format ?? "[Format]"
      }   ♪   ${props.artist?.lettercode ?? "&&"} ${
        props.artist?.numbercode ?? "##"
      }/${props.entry ?? "##"}`}
      placement="top"
    >
      <Badge
        badgeContent={props.rotation ?? null}
        color={props.rotation ? ROTATION_TONES[props.rotation]?.color : undefined}
        size="sm"
      >
        <Avatar
          variant={variant_choice}
          color={color_choice}
          sx={{
            width: "3.2rem",
            height: "3.2rem",
          }}
        >
          <Stack direction="row" spacing={0.2} sx={{ ml: -0.1 }}>
            <Stack
              direction="column"
              sx={{
                justifyContent: "center",
              }}
            >
              <Typography
                level="body-xs"
                sx={{
                  color: "text.primary",
                  width: 9.45,
                  fontSize: "0.6rem",
                  ml: -0.1,
                }}
              >
                {props.artist?.genre?.substring(0, 2)?.toUpperCase() ?? "—"}
              </Typography>
            </Stack>
            <Stack
              direction="column"
              sx={{
                textAlign: "center",
              }}
            >
              <Typography
                level="body-xs"
                sx={{ color: "text.primary", fontSize: "0.6rem" }}
              >
                {props.artist?.numbercode ?? "|"}
              </Typography>
              <Avatar
                variant={variant_choice == "solid" ? "soft" : "solid"}
                color={formatColor}
                sx={{
                  width: "1.4rem",
                  height: "1.4rem",
                  m: 0,
                  fontSize: "0.8rem",
                  bgColor: props.background,
                }}
              >
                {props.artist?.lettercode}
              </Avatar>
              <Typography
                level="body-xs"
                sx={{ color: "text.primary", fontSize: "0.6rem" }}
              >
                {props.entry ?? "|"}
              </Typography>
            </Stack>
            <Stack
              direction="column"
              sx={{
                width: 9.45,
                textAlign: "center",
                justifyContent: "center",
              }}
            >
              <Typography
                level="body-xs"
                sx={{
                  color: "text.primary",
                  fontSize: "0.6rem",
                }}
              >
                {props.format == "Unknown"
                  ? "—"
                  : props.format?.substring(0, 2).toUpperCase() ?? "--"}
              </Typography>
            </Stack>
          </Stack>
        </Avatar>
      </Badge>
    </Tooltip>
  );
};
