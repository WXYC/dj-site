import { AlbumEntry } from "../catalog/types";
import { hasLinkedAlbumId } from "../flowsheet/linkage";
import { FlowsheetQuery, FlowsheetSubmissionParams } from "../flowsheet/types";

export function convertBinToFlowsheet(
  binEntry: AlbumEntry
): FlowsheetSubmissionParams {
  // #608: gate album_id on `> 0` to drop the synthesized negative id that
  // `synthesizeAlbumId` produces for library-unlinked bin rows. Bypassed
  // `convertQueryToSubmission`'s chokepoint gate (04f027a) because
  // PlayFromBin pipes directly into `addToFlowsheet`. Without this gate
  // BS branches on `album_id != null`, takes the library-lookup path on a
  // negative id, and throws TypeError 500. Mirrors the chokepoint shape.
  //
  // rotation_id stays on the wire (BS#1308 / @wxyc/shared 1.9.0 added it to
  // FlowsheetCreateSongFreeform), so the iOS rotation-artwork resolver can
  // still find unlinked-rotation bin plays by rotation_id alone.
  const hasLinkedAlbum = hasLinkedAlbumId(binEntry.id);

  if (hasLinkedAlbum) {
    return {
      album_id: binEntry.id,
      track_title: binEntry.title,
      rotation_id: binEntry.rotation_id,
      request_flag: false,
      record_label: binEntry.label,
    };
  }

  return {
    artist_name: binEntry.artist.name,
    album_title: binEntry.title,
    track_title: binEntry.title,
    rotation_id: binEntry.rotation_id,
    request_flag: false,
    record_label: binEntry.label,
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
