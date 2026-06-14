import type { AlbumEntry } from "./types";

/** Partial row emitted by {@link patchCatalogSearchRotation} (rotation-only). */
export function isRotationSearchPatch(updated: AlbumEntry): boolean {
  return (
    updated.title === "" &&
    updated.label === "" &&
    updated.entry === 0 &&
    updated.artist.name === ""
  );
}

/** Merge a saved album into a catalog search row, keeping query-only fields. */
export function mergeAlbumIntoSearchResult(
  existing: AlbumEntry,
  updated: AlbumEntry,
): AlbumEntry {
  if (isRotationSearchPatch(updated)) {
    return {
      ...existing,
      rotation_bin: updated.rotation_bin,
      rotation_id: updated.rotation_id,
    };
  }

  return {
    ...existing,
    ...updated,
    id: existing.id,
    entry: existing.entry,
    matched_via: existing.matched_via,
    artwork_url: updated.artwork_url ?? existing.artwork_url,
    rotation_bin: existing.rotation_bin,
    rotation_id: existing.rotation_id,
    plays: existing.plays ?? updated.plays,
    add_date: existing.add_date ?? updated.add_date,
    on_streaming: updated.on_streaming ?? existing.on_streaming,
    date_lost: updated.date_lost ?? existing.date_lost,
    date_found: updated.date_found ?? existing.date_found,
    album_artist: updated.album_artist ?? existing.album_artist,
  };
}
