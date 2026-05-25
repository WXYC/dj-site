"use client";

import type { Format, Genre } from "@/lib/features/catalog/types";
import {
  GENRE_COLORS,
  GENRE_VARIANTS,
} from "../../catalog/ArtistAvatar";
import { Avatar, Badge, Stack, Typography } from "@mui/joy";

export type AdminCatalogCodePreviewProps = {
  /** Display genre name (maps to `Genre` colors when possible). */
  genreName: string | null;
  codeLetters: string;
  /** Artist number in genre; shown as "|" when empty. */
  artistNumber: string | number | null;
  /** Album entry / disc #; "?" when unknown draft. */
  albumEntry: string | number | null;
  /** e.g. "CD", "Vinyl" — drives inner letter chip color. */
  formatLabel: string | null;
  /** Optional rotation badge (usually omitted in admin draft). */
  rotation?: string | null;
  /** Compact size for artwork overlay; default full size for add/edit cards. */
  size?: "md" | "sm";
};

const SIZE_STYLES = {
  md: {
    outer: "4rem",
    inner: "1.5rem",
    innerFont: "0.75rem",
    text: "0.65rem",
    textWidth: 10,
  },
  sm: {
    outer: "2.5rem",
    inner: "1rem",
    innerFont: "0.55rem",
    text: "0.5rem",
    textWidth: 8,
  },
} as const;

function asGenreKey(name: string | null): Genre {
  if (!name || !name.trim()) return "Unknown";
  const g = name.trim();
  const keys: Genre[] = [
    "Rock",
    "Blues",
    "Electronic",
    "Hiphop",
    "Jazz",
    "Classical",
    "Reggae",
    "Soundtracks",
    "OCS",
    "Unknown",
  ];
  const hit = keys.find((k) => k.toLowerCase() === g.toLowerCase());
  return hit ?? "Unknown";
}

function asFormatKey(label: string | null): Format {
  if (!label) return "Unknown";
  return label.toLowerCase().includes("vinyl") ? "Vinyl" : "CD";
}

/**
 * Live draft preview for admin catalog Rightbar — same visual language as
 * [`ArtistAvatar`](../../catalog/ArtistAvatar.tsx) (genre color, nested letter / # / entry).
 */
export default function AdminCatalogCodePreview({
  genreName,
  codeLetters,
  artistNumber,
  albumEntry,
  formatLabel,
  rotation = null,
  size = "md",
}: AdminCatalogCodePreviewProps) {
  const s = SIZE_STYLES[size];
  const genreKey = asGenreKey(genreName);
  const color_choice = GENRE_COLORS[genreKey] ?? "neutral";
  const variant_choice = GENRE_VARIANTS[genreKey] ?? "soft";
  const fmt = asFormatKey(formatLabel);

  const genreAbbr =
    genreName && genreName.trim().length > 0
      ? genreName.trim().substring(0, 2).toUpperCase()
      : "—";
  const letters =
    codeLetters.trim().length > 0
      ? codeLetters.trim().toUpperCase().slice(0, 4)
      : "&&";
  const num =
    artistNumber !== null &&
    artistNumber !== "" &&
    String(artistNumber).trim().length > 0
      ? String(artistNumber)
      : "|";
  const entry =
    albumEntry !== null &&
    albumEntry !== "" &&
    String(albumEntry).trim().length > 0
      ? String(albumEntry)
      : "?";
  const fmtAbbr =
    formatLabel && formatLabel.trim().length > 0
      ? formatLabel.trim().substring(0, 2).toUpperCase()
      : "—";

  return (
    <Badge badgeContent={rotation || null} size="sm" color="neutral">
      <Avatar
        variant={variant_choice}
        color={color_choice}
        sx={{
          width: s.outer,
          height: s.outer,
        }}
      >
        <Stack direction="row" spacing={size === "sm" ? 0.1 : 0.2} sx={{ ml: -0.1 }}>
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
                width: s.textWidth,
                fontSize: s.text,
                ml: -0.1,
              }}
            >
              {genreAbbr}
            </Typography>
          </Stack>
          <Stack direction="column" sx={{ textAlign: "center" }}>
            <Typography
              level="body-xs"
              sx={{ color: "text.primary", fontSize: s.text }}
            >
              {num}
            </Typography>
            <Avatar
              variant={variant_choice === "solid" ? "soft" : "solid"}
              color={fmt === "CD" ? "primary" : "warning"}
              sx={{
                width: s.inner,
                height: s.inner,
                m: 0,
                fontSize: s.innerFont,
              }}
            >
              {letters}
            </Avatar>
            <Typography
              level="body-xs"
              sx={{ color: "text.primary", fontSize: s.text }}
            >
              {entry}
            </Typography>
          </Stack>
          <Stack
            direction="column"
            sx={{
              width: s.textWidth,
              textAlign: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              level="body-xs"
              sx={{
                color: "text.primary",
                fontSize: s.text,
              }}
            >
              {fmtAbbr}
            </Typography>
          </Stack>
        </Stack>
      </Avatar>
    </Badge>
  );
}
