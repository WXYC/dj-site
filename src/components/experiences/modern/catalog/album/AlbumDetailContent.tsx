"use client";

import type { AlbumInfoRequest } from "@/lib/features/catalog/libraryCode";
import AlbumCard from "../../Rightbar/panels/album/AlbumCard";
import AlbumErrorCard from "../../Rightbar/panels/album/AlbumErrorCard";
import AlbumLoadingCard from "../../Rightbar/panels/album/AlbumLoadingCard";
import { useAlbumDetailContent } from "./useAlbumDetailContent";

type AlbumDetailContentProps = {
  infoRequest: AlbumInfoRequest;
};

export default function AlbumDetailContent({
  infoRequest,
}: AlbumDetailContentProps) {
  const {
    isLoading,
    isError,
    album,
    albumId,
    artworkUrl,
    metadata,
    metadataLoading,
    artistMetadata,
    bioTokens,
    codePreview,
  } = useAlbumDetailContent(infoRequest, "view");

  if (isLoading) {
    return <AlbumLoadingCard />;
  }

  if (isError || !album || albumId === undefined) {
    return <AlbumErrorCard />;
  }

  return (
    <AlbumCard
      album={album}
      artworkUrl={artworkUrl}
      metadata={metadata}
      metadataLoading={metadataLoading}
      artistBio={artistMetadata?.bio ?? metadata?.artistBio ?? null}
      bioTokens={bioTokens}
      artistWikipediaUrl={
        artistMetadata?.wikipediaUrl ?? metadata?.artistWikipediaUrl ?? null
      }
      codePreview={codePreview}
    />
  );
}
