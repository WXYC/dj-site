"use client";

import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { useAlbumArtwork, useArtistMetadata } from "@/lib/features/metadata/hooks";
import { applicationSlice } from "@/lib/features/application/frontend";
import type { AlbumDetailPanelMode } from "@/lib/features/application/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCanEditCatalog } from "@/src/hooks/useCanEditCatalog";
import CatalogEntryEditSections from "../../admin/catalog/CatalogEntryEditSections";
import { albumEntryToCodePreview } from "../../admin/catalog/catalogEntryCodePreview";
import type { AdminCatalogCodePreviewProps } from "../../admin/catalog/AdminCatalogCodePreview";
import { rightbarFormCardsStackSx } from "../rightbarFormCardStyles";
import RightbarPanelContainer from "../RightbarPanelContainer";
import AlbumCard from "./album/AlbumCard";
import AlbumLoadingCard from "./album/AlbumLoadingCard";
import AlbumErrorCard from "./album/AlbumErrorCard";
import { Button, Stack } from "@mui/joy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EditOutlined from "@mui/icons-material/EditOutlined";

export type { AlbumDetailPanelMode };

type AlbumDetailPanelProps = {
  albumId: number;
};

export default function AlbumDetailPanel({ albumId }: AlbumDetailPanelProps) {
  const dispatch = useAppDispatch();
  const canEditCatalog = useCanEditCatalog();
  const panel = useAppSelector(applicationSlice.selectors.getRightbarPanel);

  const panelMode: AlbumDetailPanelMode =
    panel.type === "album-detail" && panel.albumId === albumId
      ? (panel.mode ?? "view")
      : "view";

  const isEditing = canEditCatalog && panelMode === "edit";

  const [editSessionKey, setEditSessionKey] = useState(0);
  const [draftCodePreview, setDraftCodePreview] =
    useState<AdminCatalogCodePreviewProps | null>(null);
  const prevPanelModeRef = useRef(panelMode);

  useEffect(() => {
    if (prevPanelModeRef.current === "edit" && panelMode === "view") {
      setDraftCodePreview(null);
      setEditSessionKey((k) => k + 1);
    }
    prevPanelModeRef.current = panelMode;
  }, [panelMode]);

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

  const handleStartEdit = useCallback(() => {
    if (!canEditCatalog) return;
    dispatch(applicationSlice.actions.setAlbumDetailMode("edit"));
  }, [canEditCatalog, dispatch]);

  const handleCancelEdit = useCallback(() => {
    dispatch(applicationSlice.actions.setAlbumDetailMode("view"));
  }, [dispatch]);

  const staticCodePreview = useMemo(
    () => (data ? albumEntryToCodePreview(data as AlbumEntry) : null),
    [data],
  );

  const codePreview = isEditing && draftCodePreview
    ? draftCodePreview
    : staticCodePreview;

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
  const title = album.album_artist ? "Various Artists" : album.artist.name;
  const subtitle = isEditing
    ? "Editing catalog entry"
    : album.title;

  const headerFooter =
    canEditCatalog && !isEditing ? (
      <Button
        size="sm"
        variant="soft"
        color="success"
        startDecorator={<EditOutlined />}
        onClick={handleStartEdit}
        data-testid="album-detail-edit-button"
      >
        Edit
      </Button>
    ) : canEditCatalog && isEditing ? (
      <Button
        size="sm"
        variant="outlined"
        color="neutral"
        onClick={handleCancelEdit}
        data-testid="album-detail-cancel-edit-button"
      >
        Cancel
      </Button>
    ) : undefined;

  return (
    <RightbarPanelContainer
      title={title}
      subtitle={subtitle}
      onClose={handleClose}
      footer={headerFooter}
    >
      <Stack sx={isEditing ? rightbarFormCardsStackSx : undefined} spacing={isEditing ? undefined : 0}>
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
        {canEditCatalog && isEditing ? (
          <CatalogEntryEditSections
            key={editSessionKey}
            albumId={albumId}
            album={album}
            onCodePreviewChange={setDraftCodePreview}
          />
        ) : null}
      </Stack>
    </RightbarPanelContainer>
  );
}
