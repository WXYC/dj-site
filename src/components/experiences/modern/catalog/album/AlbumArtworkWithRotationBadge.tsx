"use client";

import { RequireMD } from "@/src/components/shared/Authorization";
import AlbumArtworkWithCodeOverlay from "@/src/components/experiences/modern/catalog/album/AlbumArtworkWithCodeOverlay";
import { useAlbumRotationEntries } from "@/src/components/experiences/modern/catalog/album/useAlbumRotationEntries";
import type { CatalogCodePreviewProps } from "@/src/components/experiences/modern/catalog/CatalogCodePreview";
import { AlbumEntry } from "@/lib/features/catalog/types";

type BaseCodePreview = Omit<CatalogCodePreviewProps, "rotation">;

type AlbumArtworkWithRotationBadgeProps = {
  album: AlbumEntry;
  artworkUrl: string;
  alt: string;
  codePreview?: BaseCodePreview | null;
};

/**
 * `AlbumArtworkWithCodeOverlay`, plus the rotation badge for an authorized
 * viewer. The rotation-list query lives in the child mounted only inside
 * `RequireMD` -- both `fallback` and `loading` reuse the same badge-less
 * artwork so a DJ (and an MD mid-role-resolution) never issues the request.
 */
export default function AlbumArtworkWithRotationBadge({
  album,
  artworkUrl,
  alt,
  codePreview,
}: AlbumArtworkWithRotationBadgeProps) {
  const badgeless = (
    <AlbumArtworkWithCodeOverlay artworkUrl={artworkUrl} alt={alt} codePreview={codePreview} />
  );

  return (
    <RequireMD fallback={badgeless} loading={badgeless}>
      <GatedRotationArtwork
        album={album}
        artworkUrl={artworkUrl}
        alt={alt}
        codePreview={codePreview}
      />
    </RequireMD>
  );
}

function GatedRotationArtwork({
  album,
  artworkUrl,
  alt,
  codePreview,
}: AlbumArtworkWithRotationBadgeProps) {
  const { activeEntries } = useAlbumRotationEntries(album);
  const rotation = activeEntries[0]?.rotation_bin ?? null;

  return (
    <AlbumArtworkWithCodeOverlay
      artworkUrl={artworkUrl}
      alt={alt}
      codePreview={codePreview ? { ...codePreview, rotation } : null}
    />
  );
}
