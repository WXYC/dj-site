"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { useAppDispatch } from "@/lib/hooks";
import { useCanEditCatalog } from "@/src/hooks/catalogHooks";
import { useAddToBin, useBin, useDeleteFromBin } from "@/src/hooks/binHooks";
import { useCallback, useMemo } from "react";

export function useCatalogResultActions(album: AlbumEntry) {
  const dispatch = useAppDispatch();
  const canEditCatalog = useCanEditCatalog();
  const { bin, loading: binQueryLoading } = useBin();
  const { addToBin, loading: addToBinLoading } = useAddToBin();
  const { deleteFromBin, loading: removeFromBinLoading } = useDeleteFromBin();

  const inBin = useMemo(
    () => (bin ?? []).some((item) => item.id === album.id),
    [bin, album.id],
  );

  const binLoading = binQueryLoading || addToBinLoading || removeFromBinLoading;

  const openDetail = useCallback(() => {
    dispatch(
      applicationSlice.actions.openPanel({
        type: "album-detail",
        albumId: album.id,
      }),
    );
  }, [dispatch, album.id]);

  const openEdit = useCallback(() => {
    dispatch(
      applicationSlice.actions.openPanel({
        type: "admin-catalog-edit-entry",
        albumId: album.id,
      }),
    );
  }, [dispatch, album.id]);

  const toggleBin = useCallback(() => {
    if (binLoading) return;
    if (inBin) {
      deleteFromBin(album.id);
    } else {
      addToBin(album.id);
    }
  }, [album.id, addToBin, binLoading, deleteFromBin, inBin]);

  return {
    canEditCatalog,
    inBin,
    binLoading,
    openDetail,
    openEdit,
    toggleBin,
  };
}

export type CatalogResultActions = ReturnType<typeof useCatalogResultActions>;
