"use client";

import AdminCatalogCodePreview, {
  type AdminCatalogCodePreviewProps,
} from "@/src/components/experiences/modern/admin/catalog/AdminCatalogCodePreview";
import { Box } from "@mui/joy";

type AlbumArtworkWithCodeOverlayProps = {
  artworkUrl: string;
  alt: string;
  codePreview?: AdminCatalogCodePreviewProps | null;
};

const artworkSx = {
  width: { xs: 120, lg: 160 },
  height: { xs: 120, lg: 160 },
  objectFit: "cover" as const,
  borderRadius: "sm",
  flexShrink: 0,
  display: "block",
};

export default function AlbumArtworkWithCodeOverlay({
  artworkUrl,
  alt,
  codePreview,
}: AlbumArtworkWithCodeOverlayProps) {
  if (!codePreview) {
    return (
      <Box
        component="img"
        src={artworkUrl}
        alt={alt}
        data-testid="album-artwork"
        sx={artworkSx}
      />
    );
  }

  return (
    <Box
      data-testid="album-artwork-with-code"
      sx={{
        position: "relative",
        width: artworkSx.width,
        height: artworkSx.height,
        flexShrink: 0,
      }}
    >
      <Box component="img" src={artworkUrl} alt={alt} sx={artworkSx} />
      <Box
        sx={{
          position: "absolute",
          right: 6,
          bottom: 6,
          pointerEvents: "none",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
        }}
        data-testid="album-artwork-code-overlay"
      >
        <AdminCatalogCodePreview {...codePreview} size="sm" />
      </Box>
    </Box>
  );
}
