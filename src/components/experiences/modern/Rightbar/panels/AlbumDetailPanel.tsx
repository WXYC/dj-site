"use client";

import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { useAlbumArtwork, useArtistMetadata } from "@/lib/features/metadata/hooks";
import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import RightbarPanelContainer from "../RightbarPanelContainer";
import AlbumCard from "./album/AlbumCard";
import AlbumLoadingCard from "./album/AlbumLoadingCard";
import AlbumErrorCard from "./album/AlbumErrorCard";

export default function AlbumDetailPanel({ albumId }: { albumId: number }) {
  const dispatch = useAppDispatch();

  const { data, isLoading, isError } = useGetInformationQuery(
    { album_id: albumId },
    { skip: albumId === undefined || albumId === null },
  );

  const { artworkUrl, isLoading: metadataLoading, metadata } = useAlbumArtwork(
    data?.artist.name,
    data?.title,
  );

  const { artistMetadata, bioTokens } = useArtistMetadata(metadata?.discogsArtistId);

  const handleClose = () => dispatch(applicationSlice.actions.closePanel());

  if (isLoading) {
    return (
      <RightbarPanelContainer title="Album Detail" onClose={handleClose}>
        <AlbumLoadingCard />
      </RightbarPanelContainer>
    );
  }

  if (isError || !data) {
    return (
      <RightbarPanelContainer title="Album Detail" onClose={handleClose}>
        <AlbumErrorCard />
      </RightbarPanelContainer>
    );
  }

  const album = data as AlbumEntry;

  return (
    <RightbarPanelContainer
      title={album.album_artist ? "Various Artists" : album.artist.name}
      subtitle={album.title}
      onClose={handleClose}
    >
      <AlbumCard
        album={album}
        artworkUrl={artworkUrl}
        metadata={metadata}
        metadataLoading={metadataLoading}
        artistBio={artistMetadata?.bio ?? metadata?.artistBio ?? null}
        bioTokens={bioTokens}
        artistWikipediaUrl={artistMetadata?.wikipediaUrl ?? metadata?.artistWikipediaUrl ?? null}
      />
    </RightbarPanelContainer>
  );
}
