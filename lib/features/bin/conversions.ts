import { AlbumEntry, Format, Genre } from "../catalog/types";
import { FlowsheetQuery, FlowsheetSubmissionParams } from "../flowsheet/types";
import { BinQueryResponse } from "./types";

export function convertAlbumFromBin(response: BinQueryResponse): AlbumEntry {
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
    rotation_id: undefined,
    label: response.label ?? "",
  };
}

export function convertBinToFlowsheet(
  binEntry: AlbumEntry
): FlowsheetSubmissionParams {
  return {
    album_id: binEntry.id,
    track_title: binEntry.title,
    artist_name: binEntry.artist.name,
    record_label: binEntry.label,
    rotation_id: binEntry.rotation_id,
    request_flag: false,
  };
}

export function convertBinToQueue(binEntry: AlbumEntry): FlowsheetQuery {
  return {
    album_id: binEntry.id,
    song: "",
    album: binEntry.title,
    artist: binEntry.artist.name,
    label: binEntry.label,
    rotation_id: binEntry.rotation_id,
    request: false,
  };
}
