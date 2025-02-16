import { AlbumEntry, Format, Genre } from "../catalog/types";
import { BinQueryResponse } from "./types";

export function convertAlbumFromBin(
  response: BinQueryResponse
): AlbumEntry {
  return {
    id: response.album_id,
    title: response.album_title,
    artist: {
      name: response.artist_name,
      lettercode: response.code_letters,
      numbercode: response.code_artist_number,
      genre: (response.genre_name as Genre) ?? "Unknown",
      id: undefined,
    },
    entry: response.code_number,
    format: (response.format_name as Format) ?? "Unknown",
    alternate_artist: "",
    play_freq: undefined,
    add_date: undefined,
    plays: undefined,
    label: response.label ?? "",
  };
}
