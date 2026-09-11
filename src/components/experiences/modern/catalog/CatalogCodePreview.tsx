"use client";

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
  /**
   * Badges "?" instead of a bin, in the same vocabulary the code itself uses
   * for an unknown entry. An absent badge is a positive claim that the album is
   * in no bin, so a caller whose rotation read has not landed must say that it
   * does not know rather than render nothing.
   */
  rotationUnknown?: boolean;
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

// The filing code in ArtistAvatar's visual language, driven by loose strings so forms can preview a live draft.
export default function CatalogCodePreview({
  genreName,
  codeLetters,
  artistNumber,
  albumEntry,
  formatLabel,
  rotation = null,
  rotationUnknown = false,
  size = "md",
}: CatalogCodePreviewProps) {
  const s = SIZE_STYLES[size];
  const { color: color_choice, variant: variant_choice } = genreTone(genreName);
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
  // Only a known bin colors the badge; "?" stays neutral, and a badge with no
  // content at all keeps the untouched default so an absent rotation renders
  // exactly as before.
  const rotationBadge = rotation || (rotationUnknown ? "?" : null);

  return (
    <Badge
      badgeContent={rotationBadge}
      size="sm"
      color={
        rotation
          ? ROTATION_TONES[rotation]?.color
          : rotationUnknown
            ? "neutral"
            : undefined
      }
      slotProps={
        rotationBadge === "?"
          ? { badge: { title: "Rotation status unknown" } }
          : undefined
      }
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
