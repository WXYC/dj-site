import { bodyCode, serverMessage, unwrapEndpointErrorOrRaw } from "@/lib/rtk-endpoint-error";

export const RELEASE_EDIT_FALLBACK_MESSAGE = "This library release could not be modified.";
export const RELEASE_MOVE_FALLBACK_MESSAGE = "This library release could not be moved.";

/**
 * What the interpreter needs to word a refusal for the screen that sent the
 * `PATCH /library/:id`: the destination genre's name (omit while it cannot be
 * resolved), the call number the release would land at, and the artist as the
 * screen names it.
 */
export type ReleaseSaveContext = {
  screen: "editor" | "move";
  genreName?: string;
  callNumber: string;
  artistName: string;
  variousArtists: boolean;
};

/** Why a release write that changed genre was refused. `generic` is every shape this module declines to interpret. */
export type ReleaseSaveRefusal = {
  reason: "slot_taken" | "artist_not_in_genre" | "generic";
  message: string;
};

/**
 * Interprets a rejected `updateAlbum` that moved the release to another genre;
 * never throws on an unexpected body. The artist-not-in-genre refusal carries
 * no code, only its message, so that is what it is recognized by.
 */
export function interpretReleaseSaveError(err: unknown, context: ReleaseSaveContext): ReleaseSaveRefusal {
  const { screen, genreName, callNumber, artistName, variousArtists } = context;
  const generic: ReleaseSaveRefusal = {
    reason: "generic",
    message: screen === "editor" ? RELEASE_EDIT_FALLBACK_MESSAGE : RELEASE_MOVE_FALLBACK_MESSAGE,
  };
  const answer = unwrapEndpointErrorOrRaw("updateAlbumError", err);
  if (!answer || !genreName) return generic;
  const { status, data } = answer;

  if (status === 409 && bodyCode(data) === "library_slot_conflict") {
    const fix =
      screen === "editor"
        ? "Change the Release Call Number on this page and save again."
        : "Open View/Modify/Delete this Library Release to change its Release Call Number, then move it again.";
    return { reason: "slot_taken", message: `${genreName} already has a release at number ${callNumber}. ${fix}` };
  }
  if (status === 400 && /not catalogued in the selected genre/i.test(serverMessage(data) ?? "")) {
    // A compilation's artist row is a shelf section, not a performer, so
    // filing it under a new genre is not the librarian's fix to make here.
    return {
      reason: "artist_not_in_genre",
      message: variousArtists
        ? `${artistName} isn't filed under ${genreName}, so this release can't be moved there. Use Change the Library Code of This Library Release to file it under a different artist.`
        : `${artistName} isn't filed under ${genreName} yet. File the artist under ${genreName} first, then move this release.`,
    };
  }
  return generic;
}
