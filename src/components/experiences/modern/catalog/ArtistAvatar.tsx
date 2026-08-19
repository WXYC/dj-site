import type { JSX } from "react";
import { ArtistEntry, Format } from "@/lib/features/catalog/types";
import { Rotation } from "@/lib/features/rotation/types";
import {
  formatTone,
  genreTone,
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

/**
 * Two-letter badge for a genre or format. `||`, not `??`: either can arrive as
 * the empty string — the adapters carry server text verbatim and map only null
 * to a sentinel — and `??` would render a blank badge instead of the dash.
 */
const badgeAbbrev = (value: string | null | undefined): string =>
  value?.trim().substring(0, 2).toUpperCase() || "—";

export const ArtistAvatar = (props: ArtistAvatarProps): JSX.Element => {
  const tone = genreTone(props.artist?.genre);
  const color_choice = tone.color;
  const variant_choice = tone.variant;
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
                {badgeAbbrev(props.artist?.genre)}
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
                {props.format === "Unknown" ? "—" : badgeAbbrev(props.format)}
              </Typography>
            </Stack>
          </Stack>
        </Avatar>
      </Badge>
    </Tooltip>
  );
};
