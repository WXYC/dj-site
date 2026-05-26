"use client";

import {
  albumInfoRequestFromRouteId,
  catalogAlbumPath,
} from "@/lib/features/catalog/libraryCode";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import CatalogEntryEditSections from "../admin/catalog/CatalogEntryEditSections";
import AlbumErrorCard from "../Rightbar/panels/album/AlbumErrorCard";
import AlbumLoadingCard from "../Rightbar/panels/album/AlbumLoadingCard";
import { useAlbumDetailContent } from "./album/useAlbumDetailContent";
import CatalogEntryModalShell from "./CatalogEntryModalShell";

export default function CatalogAlbumEditModal() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const routeId = params.id ?? "";
  const infoRequest = useMemo(
    () => (routeId ? albumInfoRequestFromRouteId(routeId) : null),
    [routeId],
  );

  const {
    editSessionKey,
    isLoading,
    isError,
    album,
    albumId,
    artworkUrl,
  } = useAlbumDetailContent(infoRequest, "edit");

  if (!infoRequest) {
    return null;
  }

  return (
    <CatalogEntryModalShell
      variant="edit"
      size="form"
      closeAriaLabel="Close edit catalog entry"
    >
      {isLoading ? (
        <AlbumLoadingCard />
      ) : isError || !album || albumId === undefined ? (
        <AlbumErrorCard />
      ) : (
        <CatalogEntryEditSections
          key={editSessionKey}
          albumId={albumId}
          album={album}
          artworkUrl={artworkUrl}
          onSaveSuccess={() => {
            router.replace(catalogAlbumPath(routeId), { scroll: false });
          }}
        />
      )}
    </CatalogEntryModalShell>
  );
}
