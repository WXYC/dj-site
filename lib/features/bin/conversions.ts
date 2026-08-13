import { AlbumEntry } from "../catalog/types";
import { hasLinkedAlbumId } from "../flowsheet/linkage";
import { releaseCannotSupplyArtist, seedableArtistName } from "../flowsheet/various-artists-guard";
import { FlowsheetQuery, FlowsheetSubmissionParams } from "../flowsheet/types";

/**
 * `null` means Play Now must refuse the entry outright: the release leaves
 * the artist blank, either because its credit is refused or because it
 * carries none, and the flowsheet is the permanent record. Neither is
 * visible on the linked (`album_id`-only) submission shape, so the check
 * runs against the `AlbumEntry` here, before the linked/unlinked branch
 * below can hide it. Play Now has no artist field to satisfy the refusal in
 * place — the caller (useBinEntryActions) redirects the DJ to Add to Queue,
 * whose conversion below seeds a blank, editable artist instead of refusing.
 */
export function convertBinToFlowsheet(
  binEntry: AlbumEntry
): FlowsheetSubmissionParams | null {
  if (releaseCannotSupplyArtist(binEntry)) return null;

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
  //
  // Called inline (not via a saved boolean) so the predicate narrows
  // `binEntry.id` to `number` for the branch below — bin rows always resolve
  // to a real `library.id` via an inner join, but the field is `number | null`
  // to accommodate LML catalog rows, which never reach the bin.
  if (hasLinkedAlbumId(binEntry.id)) {
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

/**
 * Also the catalog search results' Add-to-Queue conversion (modern
 * `Result` / `MobileResult`), not the mail bin's alone — the name predates
 * that second caller. Any behavior change here reaches both surfaces.
 *
 * A refused credit is queued blank rather than refused outright: unlike Play
 * Now, the queue row's artist cell is editable, so it is the surface where
 * the DJ can name the performer. `usePlayNow` refuses the blank at the
 * flowsheet boundary until they do.
 */
export function convertBinToQueue(binEntry: AlbumEntry): FlowsheetQuery {
  const cannotSupplyArtist = releaseCannotSupplyArtist(binEntry);
  return {
    // Withheld together with the artist whenever the release leaves it
    // blank: BS's album_id branch spreads the library row's artist over the
    // request's, so keeping the linkage would hand the credit — or the
    // blank — right back once the DJ types a real performer into the queued
    // row (mirrors RotationEntryFields.handleSelectRelease's withholding
    // trade).
    album_id: cannotSupplyArtist ? undefined : (binEntry.id ?? undefined),
    song: "",
    album: binEntry.title,
    artist: seedableArtistName(binEntry),
    label: binEntry.label,
    rotation_id: binEntry.rotation_id,
    rotation_bin: binEntry.rotation_bin,
    request: false,
  };
}
