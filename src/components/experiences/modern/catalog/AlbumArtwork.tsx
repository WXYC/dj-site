"use client";

import type { JSX } from "react";
import Box from "@mui/joy/Box";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { genreTone } from "@/lib/features/experiences/modern/tokens/roles";

/** MUI Joy `sx` width/height value: a fixed pixel size, or a responsive breakpoint map. */
type ArtworkSize = number | Partial<Record<"xs" | "sm" | "md" | "lg" | "xl", number>>;

interface NotOnDiscogsBadgeProps {
  size: ArtworkSize;
  note?: string | null;
}

/**
 * MD-flagged "Not on Discogs" placeholder. Renders wherever an album's
 * `discogsUnavailable` flag is true, in place of any Discogs-sourced artwork —
 * the possibly-wrong match data stays in the DB, this only gates rendering.
 * Shape mirrors `ArtistAvatar.tsx` (Tooltip-wrapped fixed-size box); the
 * optional MD note surfaces as the tooltip content, falling back to a plain
 * "Not on Discogs" label when no note was recorded.
 */
export function NotOnDiscogsBadge({ size, note }: NotOnDiscogsBadgeProps): JSX.Element {
  return (
    <Tooltip variant="outlined" title={note || "Not on Discogs"} placement="top">
      <Box
        aria-label="Not on Discogs"
        sx={{
          width: size,
          height: size,
          borderRadius: "sm",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.25,
          textAlign: "center",
          bgcolor: "neutral.softBg",
          border: "1px solid",
          borderColor: "neutral.outlinedBorder",
        }}
      >
        <BlockOutlinedIcon sx={{ color: "neutral.500" }} />
        <Typography
          level="body-xs"
          sx={{
            fontSize: "0.55rem",
            lineHeight: 1.1,
            color: "text.tertiary",
            px: 0.5,
          }}
        >
          Not on Discogs
        </Typography>
      </Box>
    </Tooltip>
  );
}

interface AlbumArtworkProps {
  album: AlbumEntry;
  size: ArtworkSize;
}

/**
 * Single gate point for rendering catalog-card artwork. Priority:
 *   1. `album.discogsUnavailable === true` -> `NotOnDiscogsBadge` (never
 *      renders `artwork_url`, even if present — a flagged release's matched
 *      Discogs image is exactly the data the flag says not to trust).
 *   2. `album.artwork_url` -> `<img>`.
 *   3. Neither -> the genre-gradient lettercode placeholder.
 * `discogsUnavailable`/`discogsUnavailableNote` are optional fields on
 * `AlbumEntry`; `undefined` means "not flagged", matching every other
 * consumer of this gate (`AlbumCard.tsx`, `DiscogsUnavailableControl.tsx`).
 */
export function AlbumArtwork({ album, size }: AlbumArtworkProps): JSX.Element {
  if (album.discogsUnavailable === true) {
    return <NotOnDiscogsBadge size={size} note={album.discogsUnavailableNote} />;
  }

  if (album.artwork_url) {
    return (
      <Box
        component="img"
        src={album.artwork_url}
        alt={`${album.artist.name} - ${album.title}`}
        sx={{
          width: size,
          height: size,
          borderRadius: "sm",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  const genreColor = genreTone(album.artist.genre).color;

  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: "sm",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: (theme) =>
          `linear-gradient(135deg, ${theme.vars.palette[genreColor][400]}, ${theme.vars.palette[genreColor][700]})`,
      }}
    >
      <Typography
        level="title-sm"
        sx={{
          color: "#fff",
          opacity: 0.9,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {album.artist.lettercode}
      </Typography>
    </Box>
  );
}

export default AlbumArtwork;
