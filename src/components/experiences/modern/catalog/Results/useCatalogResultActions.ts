"use client";

import type { AlbumEntry } from "@/lib/features/catalog/types";
import type { Rotation } from "@/lib/features/rotation/types";
import { useCanEditCatalog } from "@/src/hooks/catalogHooks";
import { useCatalogAlbumNavigation } from "@/src/hooks/useCatalogAlbumNavigation";
import {
  isRealLibraryAlbumId,
  useCatalogRotationMarking,
} from "@/src/hooks/useCatalogRotationMarking";
import { useAddToBin, useBin, useDeleteFromBin } from "@/src/hooks/binHooks";
import { useCallback, useMemo } from "react";

export function useCatalogResultActions(album: AlbumEntry) {
  const { openAlbum, openAlbumEdit } = useCatalogAlbumNavigation();
  const canEditCatalog = useCanEditCatalog();
  const { bin, loading: binQueryLoading } = useBin();
  const { addToBin, loading: addToBinLoading } = useAddToBin();
  const { deleteFromBin, loading: removeFromBinLoading } = useDeleteFromBin();

  const rotation = useCatalogRotationMarking(
    isRealLibraryAlbumId(album.id) ? album.id : null,
  );

  const inBin = useMemo(
    () => (bin ?? []).some((item) => item.id === album.id),
    [bin, album.id],
  );

  const binLoading = binQueryLoading || addToBinLoading || removeFromBinLoading;

  const openDetail = useCallback(() => {
    openAlbum(album);
  }, [album, openAlbum]);

  const openEdit = useCallback(() => {
    openAlbumEdit(album);
  }, [album, openAlbumEdit]);

  const toggleBin = useCallback(() => {
    if (binLoading) return;
    if (inBin) {
      deleteFromBin(album.id);
    } else {
      addToBin(album.id);
    }
  }, [album.id, addToBin, binLoading, deleteFromBin, inBin]);

  const setRotationBin = useCallback(
    async (bin: Rotation | null) => {
      if (!canEditCatalog || !rotation.canMark || rotation.loading) return false;
      const target = rotation.activeBin === bin ? null : bin;
      return rotation.applyRotation(target);
    },
    [canEditCatalog, rotation],
  );

  /** Search/API row first; Redux holds optimistic updates after marking. */
  const displayRotationBin = album.rotation_bin ?? rotation.activeBin;

  return {
    canEditCatalog,
    canMarkRotation: canEditCatalog && rotation.canMark,
    activeRotationBin: rotation.activeBin,
    displayRotationBin,
    rotationLoading: rotation.loading,
    setRotationBin,
    inBin,
    binLoading,
    openDetail,
    openEdit,
    toggleBin,
  };
}

export type CatalogResultActions = ReturnType<typeof useCatalogResultActions>;
