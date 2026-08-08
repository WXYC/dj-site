import type { AlbumEntry } from "./types";

/** Partial row emitted by {@link patchCatalogSearchRotation} (rotation-only). */
export function isRotationSearchPatch(updated: AlbumEntry): boolean {
  return (
    updated.title === "" &&
    updated.label === "" &&
    updated.entry === 0 &&
    updated.artist.name === "" &&
    updated.genre_id === undefined &&
    updated.format_id === undefined
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

  // A nonzero `updated.entry` (Backend-Service's `code_number`) is
  // authoritative: an artist re-attribution can move the album onto a
  // freshly-issued call number (`updateAlbum` -> `generateAlbumCodeNumber`
  // when the new artist already owns the album's current one), and the
  // cached row must pick that up or it renders a call number nobody holds.
  // `0` is not a real call number — it's `convertToAlbumEntry`'s fallback
  // for an LML-only row that never got a `code_number` — so that sentinel
  // falls back to the cached call number instead of zeroing it out. The
  // fallback has to take the whole call number — `artist` (lettercode +
  // numbercode) together with `entry` — from the cached row: pairing the
  // response's (possibly re-attributed) artist with the cached entry digit
  // would print a call number that belongs to neither row.
  const callNumberFromResponse = updated.entry !== 0;

  return {
    ...existing,
    ...updated,
    id: existing.id,
    artist: callNumberFromResponse ? updated.artist : existing.artist,
    entry: callNumberFromResponse ? updated.entry : existing.entry,
    matched_via: existing.matched_via,
    artwork_url: updated.artwork_url ?? existing.artwork_url,
    rotation_bin: existing.rotation_bin,
    rotation_id: existing.rotation_id,
    plays: existing.plays ?? updated.plays,
    add_date: existing.add_date ?? updated.add_date,
    on_streaming: updated.on_streaming ?? existing.on_streaming,
    date_lost:
      updated.date_lost === undefined ? existing.date_lost : updated.date_lost,
    date_found:
      updated.date_found === undefined ? existing.date_found : updated.date_found,
    album_artist: updated.album_artist ?? existing.album_artist,
    discogsUnavailable: updated.discogsUnavailable ?? existing.discogsUnavailable,
    // `null` is a meaningful write (note cleared) and must pass through;
    // only an absent (`undefined`) field falls back to the cached value.
    discogsUnavailableNote:
      updated.discogsUnavailableNote === undefined
        ? existing.discogsUnavailableNote
        : updated.discogsUnavailableNote,
    lastDiscogsRecheckAt:
      updated.lastDiscogsRecheckAt === undefined
        ? existing.lastDiscogsRecheckAt
        : updated.lastDiscogsRecheckAt,
  };
}
