"use client";

import { useMemo } from "react";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import { AlbumEntry } from "@/lib/features/catalog/types";

// An album's active rotation entries from the shared list. Subscribes with no refetch options on purpose — every
// subscriber shares one cache entry, including the live flowsheet. Callers must fail closed while membership is unknown.
export function useAlbumRotationEntries(album: AlbumEntry) {
  const {
    data: rotationEntries,
    isFetching: rotationFetching,
    isError: rotationErrored,
    refetch: refetchRotation,
  } = useGetRotationQuery();

  // Negative (synthesized) and null ids aren't real library albums.
  const albumIdValid = album.id !== null && album.id > 0;

  // A re-binned album with an unkilled prior entry legitimately has more than one active row.
  const activeEntries = useMemo(() => {
    if (!albumIdValid || !rotationEntries) return [];
    return rotationEntries.filter(
      (entry): entry is AlbumEntry & { rotation_id: number } =>
        entry.id === album.id && typeof entry.rotation_id === "number",
    );
  }, [rotationEntries, album.id, albumIdValid]);

  const rotationStateUnknown = rotationEntries === undefined;

  return {
    activeEntries,
    albumIdValid,
    rotationStateUnknown,
    rotationFetching,
    rotationErrored,
    refetchRotation,
  };
}
