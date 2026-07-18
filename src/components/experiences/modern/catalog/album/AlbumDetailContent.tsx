"use client";

import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { useAlbumArtwork, useArtistMetadata } from "@/lib/features/metadata/hooks";
import AlbumCard from "./AlbumCard";
import AlbumErrorCard from "./AlbumErrorCard";
import AlbumLoadingCard from "./AlbumLoadingCard";

/**
 * The album card's data stack (release info, artwork, artist metadata) with
 * loading/error states. Shared by the centered modal and the docked card, so
 * both presentations hit the same RTK Query cache entries.
 */
export default function AlbumDetailContent({ albumId }: { albumId: number }) {
  const { data, isLoading, isError } = useGetInformationQuery(
    { album_id: albumId },
    { skip: !Number.isFinite(albumId) },
  );

  const { artworkUrl, isLoading: metadataLoading, metadata } = useAlbumArtwork(
    data?.artist.name,
    data?.title,
  );

  const { artistMetadata, bioTokens } = useArtistMetadata(metadata?.discogsArtistId);

  if (isLoading) {
    return <AlbumLoadingCard />;
  }

  if (isError || !data) {
    return <AlbumErrorCard />;
  }

  return (
    <AlbumCard
      album={data as AlbumEntry}
      artworkUrl={artworkUrl}
      metadata={metadata}
      metadataLoading={metadataLoading}
      artistBio={artistMetadata?.bio ?? metadata?.artistBio ?? null}
      bioTokens={bioTokens}
      artistWikipediaUrl={artistMetadata?.wikipediaUrl ?? metadata?.artistWikipediaUrl ?? null}
    />
  );
}
