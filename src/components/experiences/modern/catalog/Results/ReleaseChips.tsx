"use client";

import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";

import { Format, Genre } from "@/lib/features/catalog/types";
import { Rotation } from "@/lib/features/rotation/types";
import { getStyleForRotation } from "@/src/utilities/modern/rotationstyles";
import { GENRE_COLORS } from "../ArtistAvatar";

// Descriptor pills are tiny caption-scale and quieter than the artist text;
// only operational status (rotation, exclusive) earns stronger color. The
// row must still read well with all pills removed.
const chipSx = {
  fontSize: "0.65rem",
  fontWeight: 500,
  "--Chip-minHeight": "16px",
  "--Chip-paddingInline": "6px",
} as const;

const VISIBLE_LIMIT = 3;

function formatLabel(format: Format): string {
  if (/^cd$/i.test(format)) return "CD";
  return format.charAt(0).toUpperCase() + format.slice(1).toLowerCase();
}

type ChipItem = {
  key: string;
  label: string;
  priority: number;
  node: React.ReactNode;
};

export function ReleaseChips({
  genre,
  format,
  rotation,
  onStreaming,
}: {
  genre: Genre;
  format: Format;
  rotation?: Rotation;
  onStreaming: boolean | undefined;
}) {
  const genreColor = GENRE_COLORS[genre ?? "Unknown"] ?? "neutral";

  const items: ChipItem[] = [
    {
      key: "genre",
      label: genre,
      priority: 2,
      node: (
        <Chip key="genre" variant="soft" color={genreColor} size="sm" sx={chipSx}>
          {genre}
        </Chip>
      ),
    },
    {
      key: "format",
      label: formatLabel(format),
      priority: 1,
      node: (
        <Chip key="format" variant="soft" color="neutral" size="sm" sx={chipSx}>
          {formatLabel(format)}
        </Chip>
      ),
    },
  ];
  if (rotation) {
    items.push({
      key: "rotation",
      label: `Rotation ${rotation}`,
      priority: 3,
      node: (
        <Chip
          key="rotation"
          variant="solid"
          color={getStyleForRotation(rotation)}
          size="sm"
          sx={chipSx}
          aria-label={`Rotation ${rotation}`}
        >
          {rotation}
        </Chip>
      ),
    });
  }
  if (onStreaming === false) {
    items.push({
      key: "exclusive",
      label: "WXYC EXCLUSIVE",
      priority: 3,
      node: (
        <Chip
          key="exclusive"
          variant="soft"
          size="sm"
          sx={{
            ...chipSx,
            backgroundColor: "#7B2D8E",
            color: "#fff",
            letterSpacing: "0.5px",
          }}
        >
          WXYC EXCLUSIVE
        </Chip>
      ),
    });
  }

  // Cap the cluster: keep the most important pills, fold the rest into +N.
  let visible = items;
  let hidden: ChipItem[] = [];
  if (items.length > VISIBLE_LIMIT) {
    const keep = new Set(
      [...items]
        .sort((a, b) => b.priority - a.priority)
        .slice(0, VISIBLE_LIMIT)
        .map((item) => item.key)
    );
    visible = items.filter((item) => keep.has(item.key));
    hidden = items.filter((item) => !keep.has(item.key));
  }

  return (
    <Stack
      direction="row"
      gap={0.75}
      alignItems="center"
      flexWrap="wrap"
      onClick={(e) => e.stopPropagation()}
    >
      {visible.map((item) => item.node)}
      {hidden.length > 0 && (
        <Tooltip
          title={hidden.map((item) => item.label).join(", ")}
          variant="outlined"
          size="sm"
        >
          <Chip
            variant="soft"
            color="neutral"
            size="sm"
            tabIndex={0}
            sx={chipSx}
            aria-label={`${hidden.length} more: ${hidden
              .map((item) => item.label)
              .join(", ")}`}
          >
            +{hidden.length}
          </Chip>
        </Tooltip>
      )}
    </Stack>
  );
}
