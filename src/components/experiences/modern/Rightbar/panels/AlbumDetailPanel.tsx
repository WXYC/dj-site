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
    data?.discogsUnavailable === true,
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
      // See AlbumCard: `album_artist` is empty for every row on the
      // compilation shelf, so the branch that used to read it here titled no
      // panel it was written for and displaced the shelf name for the rest.
      title={album.artist.name}
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
