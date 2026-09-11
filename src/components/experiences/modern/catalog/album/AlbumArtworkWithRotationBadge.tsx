"use client";

import { RequireMD } from "@/src/components/shared/Authorization";
import AlbumArtworkWithCodeOverlay from "@/src/components/experiences/modern/catalog/album/AlbumArtworkWithCodeOverlay";
import { useAlbumRotationEntries } from "@/src/components/experiences/modern/catalog/album/useAlbumRotationEntries";
import type { CatalogCodePreviewProps } from "@/src/components/experiences/modern/catalog/CatalogCodePreview";
import { AlbumEntry } from "@/lib/features/catalog/types";

// Both rotation props belong to this component: the caller supplies the filing
// code, the rotation read here supplies the badge and whether it is knowable.
type BaseCodePreview = Omit<
  CatalogCodePreviewProps,
  "rotation" | "rotationUnknown"
>;

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
 * For a DJ that artwork makes no rotation claim at all, since no badge ever
 * appears on it; for an MD it would, which is why the gated child distinguishes
 * "in no bin" from "not known yet".
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
  const { activeEntries, rotationStateUnknown } = useAlbumRotationEntries(album);
  // Failing closed, as `useAlbumRotationEntries` requires: an absent badge is
  // this surface's way of saying "in no bin", so until membership is known the
  // badge has to say "unknown" instead. A read that errored after a good one
  // keeps showing the last known bins, matching how the classify control treats
  // the same signals -- `rotationStateUnknown` is the fail-closed gate there
  // too, and `rotationErrored` only chooses the wording behind it.
  const rotation = rotationStateUnknown
    ? null
    : (activeEntries[0]?.rotation_bin ?? null);

  return (
    <AlbumArtworkWithCodeOverlay
      artworkUrl={artworkUrl}
      alt={alt}
      codePreview={
        codePreview
          ? { ...codePreview, rotation, rotationUnknown: rotationStateUnknown }
          : null
      }
    />
  );
}
