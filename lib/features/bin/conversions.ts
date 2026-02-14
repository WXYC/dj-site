import { AlbumEntry } from "../catalog/types";
import { FlowsheetQuery, FlowsheetSubmissionParams } from "../flowsheet/types";

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
    rotation_bin: binEntry.rotation_bin,
    request: false,
  };
}
