import type { BinLibraryDetails } from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";
import { AlbumEntry, AlbumSearchResultJSON, Format, Genre } from "./types";

function isSearchResult(
  response: AlbumSearchResultJSON | BinLibraryDetails
): response is AlbumSearchResultJSON {
  return "id" in response && response.id !== undefined;
}

// Stable synthetic id for rows whose canonical id is null/missing. The BS
// catalog proxy returns `id: null` for LML-only and unlinked-rotation rows
// (see dj-site#564 + Backend-Service#689); without this, multiple such rows in
// the same list collapse to a single React key. The hash is deterministic
// across renders and negated so it can't collide with real positive album ids.
function synthesizeAlbumId(
  response: AlbumSearchResultJSON | BinLibraryDetails
): number {
  const key = [
    response.artist_name ?? "",
    response.album_title ?? "",
    response.label ?? "",
    response.code_letters ?? "",
    response.code_artist_number ?? "",
    response.code_number ?? "",
  ].join("|");
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return -(Math.abs(hash) || 1);
}

export function convertToAlbumEntry(
  response: AlbumSearchResultJSON | BinLibraryDetails
): AlbumEntry {
  const rawId = isSearchResult(response)
    ? response.id
    : (response as BinLibraryDetails).album_id;
  const id =
    typeof rawId === "number" && Number.isFinite(rawId) && rawId > 0
      ? rawId
      : synthesizeAlbumId(response);

  return {
    id,
    title: response.album_title ?? "",
    artist: {
      name: response.artist_name ?? "",
      lettercode: response.code_letters ?? "",
      numbercode: response.code_artist_number ?? 0,
      genre: (response.genre_name as Genre) ?? "Unknown",
      id: undefined,
    },
    entry: response.code_number ?? 0,
    format: (response.format_name as Format) ?? "Unknown",
    alternate_artist: "",
    album_artist: isSearchResult(response) ? response.album_artist : undefined,
    // `rotation_bin` and `rotation_id` are populated by BS's `getRotationFromDB`
    // query independently of the `library` LEFT JOIN (see
    // Backend-Service/apps/backend/services/library.service.ts: `rotation.id AS
    // rotation_id`, `rotation.rotation_bin AS rotation_bin`), so they survive
    // for rotation rows whose `album_id` doesn't link to a library row. Reading
    // them through `isSearchResult` (which gates on `id`, i.e. `library.id`)
    // dropped them for library-unlinked rotation rows — dj-site#691. Other
    // library-bound fields below (`add_date`, `plays`, `on_streaming`,
    // `date_lost`, `date_found`, `artwork_url`, `matched_via`, `album_artist`)
    // legitimately stay gated: they ARE null on unlinked rotation rows.
    rotation_bin: ((response as Record<string, unknown>).rotation_bin as
      | Rotation
      | undefined),
    add_date: isSearchResult(response) ? response.add_date : undefined,
    plays: isSearchResult(response) ? response.plays : undefined,
    label: response.label ?? "",
    rotation_id: (response as Record<string, unknown>).rotation_id as
      | number
      | undefined,
    on_streaming: isSearchResult(response) ? (response as Record<string, unknown>).on_streaming as boolean | undefined : undefined,
    date_lost: isSearchResult(response) ? (response as Record<string, unknown>).date_lost as string | undefined : undefined,
    date_found: isSearchResult(response) ? (response as Record<string, unknown>).date_found as string | undefined : undefined,
    artwork_url: isSearchResult(response) ? (response as Record<string, unknown>).artwork_url as string | null | undefined : undefined,
    matched_via: isSearchResult(response) ? response.matched_via : undefined,
  };
}

