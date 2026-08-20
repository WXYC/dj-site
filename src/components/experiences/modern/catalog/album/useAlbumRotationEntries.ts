"use client";

import { useMemo } from "react";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import { AlbumEntry } from "@/lib/features/catalog/types";

/**
 * An album's active rotation entries, derived from the shared active-rotation
 * list. Subscribes with no options on purpose: `getRotation` takes a void arg,
 * so every subscriber shares one cache entry, and any refetch option added
 * here would fire refetches into the live flowsheet logging path's
 * subscription as well.
 *
 * `rotationStateUnknown` is true until the first load lands. Callers must
 * fail closed on it — offering an "add to rotation" affordance while
 * membership is unknown invites a duplicate active entry, which the backend's
 * bare insert accepts.
 */
export function useAlbumRotationEntries(album: AlbumEntry) {
  const {
    data: rotationEntries,
    isFetching: rotationFetching,
    isError: rotationErrored,
    refetch: refetchRotation,
  } = useGetRotationQuery();

  // `synthesizeAlbumId` hands out negative ids to rows the library never
  // linked; neither read nor write may treat one of those as a real album.
  // A null id (LML row) is equally invalid here.
  const albumIdValid = album.id !== null && album.id > 0;

  // Both reads project `library.id` as the row id, so matching on it is
  // matching library album to library album. `getRotationFromDB` dedupes with
  // `rotation_bin` as part of the uniqueness key, so a re-binned album with an
  // unkilled prior entry surfaces as more than one row here — every one of
  // them is a genuinely active entry for this album, not a mismatch.
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
