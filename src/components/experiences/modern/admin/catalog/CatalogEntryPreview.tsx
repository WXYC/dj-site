"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { Chip, ColorPaletteProp, Stack, Typography } from "@mui/joy";

/**
 * Read-only catalog row matching flowsheet CODE / vinyl chip presentation.
 */
export default function CatalogEntryPreview({ entry }: { entry: AlbumEntry }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      data-testid="catalog-entry-preview"
      sx={{
        p: 1,
        borderRadius: "sm",
        bgcolor: "background.level1",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
        <Typography level="body-xs" sx={{ mb: -0.5, color: "text.tertiary" }}>
          CODE
        </Typography>
        <Typography
          component="div"
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: "monospace",
            fontSize: "1rem",
          }}
        >
          {entry.artist.genre} {entry.artist.lettercode} {entry.artist.numbercode}/
          {entry.entry}
          <Chip
            variant="soft"
            size="sm"
            color={
              (String(entry.format).toLowerCase().includes("vinyl")
                ? "primary"
                : "info") as ColorPaletteProp
            }
            sx={{ ml: 2 }}
          >
            {String(entry.format).toLowerCase().includes("vinyl") ? "vinyl" : "cd"}
          </Chip>
          {entry.on_streaming === false && (
            <Chip
              variant="soft"
              size="sm"
              sx={{
                ml: 1,
                backgroundColor: "#7B2D8E",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "0.6rem",
              }}
            >
              EXCLUSIVE
            </Chip>
          )}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
        <Typography level="body-xs" sx={{ mb: -0.5, color: "text.tertiary" }}>
          ARTIST
        </Typography>
        <Typography sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.artist.name || "Unknown"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
        <Typography level="body-xs" sx={{ mb: -0.5, color: "text.tertiary" }}>
          ALBUM
        </Typography>
        <Typography sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.title || "Unknown"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
        <Typography level="body-xs" sx={{ mb: -0.5, color: "text.tertiary" }}>
          LABEL
        </Typography>
        <Typography sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.label || "Unknown"}
        </Typography>
      </Stack>
    </Stack>
  );
}
