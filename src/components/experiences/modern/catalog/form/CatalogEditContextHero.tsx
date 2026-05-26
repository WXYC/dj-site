"use client";

import type { AlbumEntry } from "@/lib/features/catalog/types";
import AdminCatalogCodePreview, {
  type AdminCatalogCodePreviewProps,
} from "@/src/components/experiences/modern/admin/catalog/AdminCatalogCodePreview";
import { Box, Stack, Typography } from "@mui/joy";

type CatalogEditContextHeroProps = {
  album: AlbumEntry;
  artworkUrl: string;
  codePreview: AdminCatalogCodePreviewProps;
};

export default function CatalogEditContextHero({
  album,
  artworkUrl,
  codePreview,
}: CatalogEditContextHeroProps) {
  const displayArtist = album.album_artist ? "Various Artists" : album.artist.name;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      data-testid="catalog-edit-context-header"
    >
      <Box
        data-testid="catalog-edit-context-artwork"
        sx={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}
      >
        <Box
          component="img"
          src={artworkUrl}
          alt={`${album.title} cover`}
          sx={{
            width: 56,
            height: 56,
            objectFit: "cover",
            borderRadius: "sm",
            display: "block",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            right: 2,
            bottom: 2,
            pointerEvents: "none",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
          }}
        >
          <AdminCatalogCodePreview {...codePreview} size="sm" />
        </Box>
      </Box>
      <Stack sx={{ minWidth: 0, flex: 1 }}>
        <Typography level="title-sm" sx={{ lineHeight: 1.3 }}>
          {displayArtist} &bull; {album.title}
        </Typography>
        {album.album_artist ? (
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            {album.album_artist}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}
