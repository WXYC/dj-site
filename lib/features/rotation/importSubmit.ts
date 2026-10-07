import type { RotationRowSummary } from "@wxyc/shared/dtos";
import type { AddAlbumRequestBody, AddArtistRequestBody } from "../catalog/types";

/**
 * Where an import ended up. The release create carries `from_rotation_id`, so
 * it links the row in the same transaction: a created-but-unlinked release
 * cannot exist, and a refused create writes nothing. Only an artist this
 * import created in its own earlier request can outlive a failure.
 */
export type ImportOutcome =
  | {
      kind: "linked";
      artistId: number;
      codeLetters: string;
      codeNumber: number | undefined;
      codeVolumeLetters: string | undefined;
      rotationId: number;
    }
  /** The row was catalogued while the form was open. Nothing was created. */
  | { kind: "stale" }
  /** The staleness re-read itself failed, so it is not known whether the row is free. */
  | { kind: "unchecked"; error: unknown }
  | { kind: "artist-failed"; error: unknown }
  | { kind: "album-failed"; error: unknown; artistId: number; createdArtist: boolean };

export type ImportChainDeps = {
  /** Re-reads the rotation row. Must issue a request rather than replay a cached one. */
  readRotationRow: (rotationId: number) => Promise<RotationRowSummary>;
  createArtist: (body: AddArtistRequestBody) => Promise<{ id: number }>;
  createAlbum: (
    body: AddAlbumRequestBody,
  ) => Promise<{ id: number } & Record<string, unknown>>;
};

export type ImportRequest = {
  rotationId: number;
  artistName: string;
  albumTitle: string;
  /** Present on the existing-artist branch; absent when the artist is being created here. */
  artistId?: number;
  /**
   * The artist's call letters, which decide which of the two artist cards the
   * success lands on. Known on both branches — off the selected match, or off
   * the form that is about to create the artist — and never read back out of
   * the create response, which does not carry them.
   */
  codeLetters: string;
  /** Present on the new-artist branch. */
  newArtist?: AddArtistRequestBody;
  album: Omit<AddAlbumRequestBody, "artist_id" | "album_title" | "from_rotation_id">;
};

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;
const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * Create the library release and link the rotation row to it, as one request.
 *
 * The link is not a step a librarian is trusted to remember: the backlog of
 * unlinked rotation rows this screen exists to work through is the measured
 * cost of a design where linking lived on its own screen. So the release
 * create names the row (`from_rotation_id`) and the backend links it in the
 * same transaction.
 *
 * The re-read at the top spares a tab left open while the row was catalogued
 * elsewhere a refused request. A re-read that itself fails is reported as
 * `unchecked` rather than assumed free: not knowing whether the row is linked
 * is not the same as knowing it is not.
 */
export async function runRotationImport(
  request: ImportRequest,
  deps: ImportChainDeps,
): Promise<ImportOutcome> {
  let current: RotationRowSummary;
  try {
    current = await deps.readRotationRow(request.rotationId);
  } catch (error) {
    return { kind: "unchecked", error };
  }
  if (current.album_id != null) return { kind: "stale" };

  let artistId = request.artistId;
  let createdArtist = false;
  if (request.newArtist) {
    try {
      artistId = (await deps.createArtist(request.newArtist)).id;
      createdArtist = true;
    } catch (error) {
      return { kind: "artist-failed", error };
    }
  }
  if (artistId == null) {
    throw new Error("runRotationImport: neither an existing artist nor a new one was given");
  }

  let album: { id: number } & Record<string, unknown>;
  try {
    album = await deps.createAlbum({
      ...request.album,
      artist_id: artistId,
      album_title: request.albumTitle,
      from_rotation_id: request.rotationId,
    });
  } catch (error) {
    return { kind: "album-failed", error, artistId, createdArtist };
  }

  const codeNumber = numberOrUndefined(album.code_number);
  const codeVolumeLetters = stringOrUndefined(album.code_volume_letters);
  return {
    kind: "linked",
    artistId,
    codeLetters: request.codeLetters,
    codeNumber,
    codeVolumeLetters,
    rotationId: request.rotationId,
  };
}
