"use client";

import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { useAlbumArtwork, useArtistMetadata } from "@/lib/features/metadata/hooks";
import { Modal } from "@mui/joy";
import { useParams, useRouter } from "next/navigation";
import AlbumCard from "../components/AlbumCard";
import AlbumErrorCard from "../components/AlbumErrorCard";
import AlbumLoadingCard from "../components/AlbumLoadingCard";

export default function AlbumPopup() {
  const router = useRouter();

  const params = useParams<{ id: string }>();

  const { data, isLoading, isError } = useGetInformationQuery(
    {
      album_id: Number(params.id),
    },
    {
      skip: params.id === undefined || params.id === null,
    }
  );

  const { artworkUrl, isLoading: metadataLoading, metadata } = useAlbumArtwork(
    data?.artist.name,
    data?.title,
  );

  const { artistMetadata } = useArtistMetadata(metadata?.discogsArtistId);

  return (
    <Modal
      open={true}
      onClose={() => router.back()}
      sx={{
        zIndex: 90000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isLoading ? (
        <AlbumLoadingCard />
      ) : isError || !data ? (
        <AlbumErrorCard />
      ) : (
        <AlbumCard
          album={data as AlbumEntry}
          artworkUrl={artworkUrl}
          metadata={metadata}
          metadataLoading={metadataLoading}
          artistBio={artistMetadata?.bio ?? metadata?.artistBio ?? null}
          artistWikipediaUrl={artistMetadata?.wikipediaUrl ?? metadata?.artistWikipediaUrl ?? null}
        />
      )}
    </Modal>
  );
}
