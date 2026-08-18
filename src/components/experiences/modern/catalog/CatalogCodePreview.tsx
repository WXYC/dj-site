"use client";

import type { Genre } from "@/lib/features/catalog/types";
import type { Rotation } from "@/lib/features/rotation/types";
import {
  formatTone,
  genreTone,
  ROTATION_TONES,
} from "@/lib/features/experiences/modern/tokens/roles";
import { Avatar, Badge, Stack, Typography } from "@mui/joy";

export type CatalogCodePreviewProps = {
  /** Display genre name (maps to `Genre` tones when possible). */
  genreName: string | null;
  codeLetters: string;
  /** Artist number in genre; shown as "|" when empty. */
  artistNumber: string | number | null;
  /** Album entry / disc #; "?" when unknown draft. */
  albumEntry: string | number | null;
  /** e.g. "CD", "Vinyl" — drives inner letter chip color. */
  formatLabel: string | null;
  /** Optional rotation badge (omitted for drafts not yet classified). */
  rotation?: Rotation | null;
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

// `genreTone` resolves unknown strings to the Unknown tone but matches keys
// exactly; draft input arrives in whatever case the form holds, so normalize
// to the canonical key first to keep the match case-insensitive.
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

/**
 * The library filing code rendered in `ArtistAvatar`'s visual language (genre
 * tone, nested letter / # / entry), but driven by loose string props instead of
 * an `ArtistEntry` so it can render a live draft while a form is being filled.
 */
export default function CatalogCodePreview({
  genreName,
  codeLetters,
  artistNumber,
  albumEntry,
  formatLabel,
  rotation = null,
  size = "md",
}: CatalogCodePreviewProps) {
  const s = SIZE_STYLES[size];
  const { color: color_choice, variant: variant_choice } = genreTone(
    asGenreKey(genreName),
  );
  const formatColor = formatTone(formatLabel).color;

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
    <Badge
      badgeContent={rotation || null}
      size="sm"
      color={rotation ? ROTATION_TONES[rotation]?.color : undefined}
    >
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
              color={formatColor}
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
