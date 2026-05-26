"use client";

import {
  albumInfoRequestFromRouteId,
  catalogAlbumPath,
} from "@/lib/features/catalog/libraryCode";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import CatalogEntryEditSections from "../admin/catalog/CatalogEntryEditSections";
import AlbumCard from "../Rightbar/panels/album/AlbumCard";
import AlbumErrorCard from "../Rightbar/panels/album/AlbumErrorCard";
import AlbumLoadingCard from "../Rightbar/panels/album/AlbumLoadingCard";
import { rightbarFormCardsStackSx } from "../Rightbar/rightbarFormCardStyles";
import { Stack } from "@mui/joy";
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
    setDraftCodePreview,
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
  } = useAlbumDetailContent(infoRequest, "edit");

  if (!infoRequest) {
    return null;
  }

  return (
    <CatalogEntryModalShell
      variant="edit"
      closeAriaLabel="Close edit catalog entry"
    >
      {isLoading ? (
        <AlbumLoadingCard />
      ) : isError || !album || albumId === undefined ? (
        <AlbumErrorCard />
      ) : (
        <Stack sx={rightbarFormCardsStackSx}>
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
          <CatalogEntryEditSections
            key={editSessionKey}
            albumId={albumId}
            album={album}
            onCodePreviewChange={setDraftCodePreview}
            onSaveSuccess={() => {
              router.replace(catalogAlbumPath(routeId), { scroll: false });
            }}
          />
        </Stack>
      )}
    </CatalogEntryModalShell>
  );
}
