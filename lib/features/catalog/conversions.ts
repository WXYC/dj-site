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
    // `rotation_bin` and `rotation_id` come from the `rotation` table on the BS
    // /library/rotation read path (see `getRotationFromDB` in
    // Backend-Service/apps/backend/services/library.service.ts:310,313).
    // They're populated on every rotation row independently of the LEFT JOIN
    // to `library`, so they must NOT be gated on `isSearchResult` (which keys
    // on `library.id` being present). Without this, library-unlinked rotation
    // rows lose their rotation linkage in the picker — see dj-site#691, the
    // Yenbett / Noura Mint Seymali symptom (2026-06-02). `BinLibraryDetails`
    // legitimately lacks these fields, so we narrow with an `in`-operator
    // check rather than the union discriminator.
    rotation_bin:
      "rotation_bin" in response
        ? (response.rotation_bin as Rotation | undefined)
        : undefined,
    add_date: isSearchResult(response) ? response.add_date : undefined,
    plays: isSearchResult(response) ? response.plays : undefined,
    label: response.label ?? "",
    rotation_id:
      "rotation_id" in response ? response.rotation_id : undefined,
    on_streaming: isSearchResult(response) ? (response as Record<string, unknown>).on_streaming as boolean | undefined : undefined,
    date_lost: isSearchResult(response) ? (response as Record<string, unknown>).date_lost as string | undefined : undefined,
    date_found: isSearchResult(response) ? (response as Record<string, unknown>).date_found as string | undefined : undefined,
    artwork_url: isSearchResult(response) ? (response as Record<string, unknown>).artwork_url as string | null | undefined : undefined,
    matched_via: isSearchResult(response) ? response.matched_via : undefined,
  };
}

