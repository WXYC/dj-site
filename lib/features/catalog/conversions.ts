import { AlbumEntry, AlbumQueryResponse, Format } from "./types";

export function convertAlbumFromSearch(
  response: AlbumQueryResponse
): AlbumEntry {
  return {
    id: response.id,
    title: response.album_title,
    artist: {
      name: response.artist_name,
      lettercode: response.code_letters,
      numbercode: response.code_artist_number,
      genre: {
        name: response.genre_name,
        id: response.id,
      },
      id: response.id,
    },
    entry: response.code_number,
    format: (response.format_name as Format) ?? "Unknown",
    alternate_artist: "",
    play_freq: response.play_freq,
  };
}
