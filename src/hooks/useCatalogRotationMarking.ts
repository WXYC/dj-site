"use client";

import { catalogApi } from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { patchCatalogSearchRotation } from "@/lib/features/catalog/patchSearchCaches";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import {
  useAddRotationEntryMutation,
  useGetRotationQuery,
  useKillRotationEntryMutation,
} from "@/lib/features/rotation/api";
import type { Rotation } from "@/lib/features/rotation/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import type { AppStore } from "@/lib/store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "react-redux";

export function isRealLibraryAlbumId(
  albumId: number | null | undefined,
): albumId is number {
  return typeof albumId === "number" && Number.isFinite(albumId) && albumId > 0;
}

export function findActiveRotationForAlbum(
  rotationList: AlbumEntry[] | undefined,
  albumId: number,
): { bin: Rotation; rotationId: number } | null {
  if (!rotationList) return null;
  const match = rotationList.find(
    (entry) =>
      entry.id === albumId &&
      entry.rotation_id !== undefined &&
      entry.rotation_bin !== undefined,
  );
  if (!match?.rotation_bin || match.rotation_id === undefined) return null;
  return { bin: match.rotation_bin, rotationId: match.rotation_id };
}

export function useCatalogRotationMarking(albumId: number | null) {
  const dispatch = useAppDispatch();
  const store = useStore() as AppStore;
  const canMark = isRealLibraryAlbumId(albumId);

  const reduxRotation = useAppSelector((state) =>
    canMark
      ? catalogSlice.selectors.getAlbumRotation(state, albumId)
      : undefined,
  );

  const { data: rotationList, isFetching: rotationLoading } =
    useGetRotationQuery(undefined, { skip: !canMark });

  const [addRotationEntry, { isLoading: adding }] =
    useAddRotationEntryMutation();
  const [killRotationEntry, { isLoading: killing }] =
    useKillRotationEntryMutation();

  const serverActive = useMemo(() => {
    if (!canMark) return null;
    return findActiveRotationForAlbum(rotationList, albumId);
  }, [albumId, canMark, rotationList]);

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
  }, [albumId]);

  useEffect(() => {
    if (hydrated || !canMark) return;
    if (rotationLoading && !serverActive && reduxRotation === undefined) {
      return;
    }
    if (reduxRotation === undefined && serverActive) {
      dispatch(
        catalogSlice.actions.setAlbumRotation({
          albumId,
          rotation_bin: serverActive.bin,
          rotation_id: serverActive.rotationId,
        }),
      );
    }
    setHydrated(true);
  }, [
    albumId,
    canMark,
    dispatch,
    hydrated,
    reduxRotation,
    rotationLoading,
    serverActive,
  ]);

  const selectedBin =
    reduxRotation !== undefined
      ? (reduxRotation.rotation_bin ?? null)
      : (serverActive?.bin ?? null);
  const activeRotationId =
    reduxRotation !== undefined
      ? reduxRotation.rotation_id
      : serverActive?.rotationId;

  const loading = adding || killing || (canMark && rotationLoading && !hydrated);

  const applyRotation = useCallback(
    async (
      targetBin?: Rotation | null,
      targetAlbumId?: number,
    ): Promise<boolean> => {
      const resolvedAlbumId = targetAlbumId ?? albumId;
      if (!isRealLibraryAlbumId(resolvedAlbumId)) return false;

      const desired = targetBin !== undefined ? targetBin : selectedBin;
      const currentBin = reduxRotation?.rotation_bin ?? null;
      const currentId = reduxRotation?.rotation_id;

      if (desired === currentBin) {
        return true;
      }

      try {
        if (currentId !== undefined) {
          await killRotationEntry({
            rotation_id: currentId,
            kill_date: undefined,
          }).unwrap();
        }

        let newRotationId: number | undefined;
        if (desired !== null) {
          const created = await addRotationEntry({
            album_id: resolvedAlbumId,
            rotation_bin: desired,
          }).unwrap();
          newRotationId =
            typeof created?.id === "number" ? created.id : undefined;
        }

        let albumHint: AlbumEntry | undefined;
        const infoResult = await dispatch(
          catalogApi.endpoints.getInformation.initiate({
            album_id: resolvedAlbumId,
          }),
        );
        if (infoResult.data) {
          albumHint = infoResult.data;
        }

        patchCatalogSearchRotation(
          dispatch,
          store.getState,
          resolvedAlbumId,
          {
            rotation_bin: desired ?? undefined,
            rotation_id: newRotationId,
          },
          albumHint,
        );

        return true;
      } catch {
        return false;
      }
    },
    [
      addRotationEntry,
      albumId,
      dispatch,
      killRotationEntry,
      reduxRotation?.rotation_bin,
      reduxRotation?.rotation_id,
      selectedBin,
      store.getState,
    ],
  );

  const setSelectedBin = useCallback(
    (bin: Rotation | null) => applyRotation(bin),
    [applyRotation],
  );

  return {
    canMark,
    selectedBin,
    setSelectedBin,
    activeBin: selectedBin,
    activeRotationId,
    loading,
    applyRotation,
    hydrated,
  };
}
