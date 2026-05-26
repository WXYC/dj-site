"use client";

import { useGetInformationQuery } from "@/lib/features/catalog/api";
import type { AlbumInfoRequest } from "@/lib/features/catalog/libraryCode";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { useAlbumArtwork, useArtistMetadata } from "@/lib/features/metadata/hooks";
import { useCanEditCatalog } from "@/src/hooks/catalogHooks";
import { albumEntryToCodePreview } from "../../admin/catalog/catalogEntryCodePreview";
import type { AdminCatalogCodePreviewProps } from "../../admin/catalog/AdminCatalogCodePreview";
import { useEffect, useMemo, useRef, useState } from "react";

export type AlbumDetailMode = "view" | "edit";

export function useAlbumDetailContent(
  infoRequest: AlbumInfoRequest | null,
  panelMode: AlbumDetailMode,
) {
  const canEditCatalog = useCanEditCatalog();
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

  const { data, isLoading, isError } = useGetInformationQuery(infoRequest!, {
    skip: infoRequest === null,
  });

  const { artworkUrl, isLoading: metadataLoading, metadata } = useAlbumArtwork(
    data?.artist.name,
    data?.title,
  );

  const { artistMetadata, bioTokens } = useArtistMetadata(metadata?.discogsArtistId);

  const staticCodePreview = useMemo(
    () => (data ? albumEntryToCodePreview(data as AlbumEntry) : null),
    [data],
  );

  const codePreview =
    isEditing && draftCodePreview ? draftCodePreview : staticCodePreview;

  const album = data as AlbumEntry | undefined;
  const albumId = album?.id;

  return {
    canEditCatalog,
    isEditing,
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
  };
}
