import type { BinLibraryDetails } from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";
import { AlbumEntry, AlbumSearchResultJSON, Format, Genre } from "./types";

function isSearchResult(
  response: AlbumSearchResultJSON | BinLibraryDetails
): response is AlbumSearchResultJSON {
  return "id" in response && response.id !== undefined;
}

export function convertToAlbumEntry(
  response: AlbumSearchResultJSON | BinLibraryDetails
): AlbumEntry {
  const id = isSearchResult(response) ? response.id : (response.album_id ?? 0);

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
    rotation_bin: isSearchResult(response)
      ? (response.rotation_bin as Rotation)
      : undefined,
    add_date: isSearchResult(response) ? response.add_date : undefined,
    plays: (isSearchResult(response) ? response.plays : undefined) ?? 0,
    label: response.label ?? "",
    rotation_id: isSearchResult(response) ? response.rotation_id : undefined,
  };
}

