"use client";

import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { AlbumEntry } from "@/lib/features/catalog/types";
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
        <AlbumCard album={data as AlbumEntry} />
      )}
    </Modal>
  );
}
