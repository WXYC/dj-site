import { bodyCode, serverMessage, unwrapEndpointErrorOrRaw } from "@/lib/rtk-endpoint-error";

export const RELEASE_EDIT_FALLBACK_MESSAGE = "This library release could not be modified.";
export const RELEASE_MOVE_FALLBACK_MESSAGE = "This library release could not be moved.";
export const RELEASE_MODERN_FALLBACK_MESSAGE = "Failed to update album";

const FALLBACK_MESSAGES = {
  editor: RELEASE_EDIT_FALLBACK_MESSAGE,
  move: RELEASE_MOVE_FALLBACK_MESSAGE,
  modern: RELEASE_MODERN_FALLBACK_MESSAGE,
} as const;

/**
 * What the interpreter needs to word a refusal for the screen that sent the
 * `PATCH /library/:id`: the destination genre's name (omit while it cannot be
 * resolved), the call number the release would land at, and the artist as the
 * screen names it.
 */
export type ReleaseSaveContext = {
  screen: keyof typeof FALLBACK_MESSAGES;
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

type RefusalReason = Exclude<ReleaseSaveRefusal["reason"], "generic">;

function refusalReason(status: unknown, data: unknown): RefusalReason | undefined {
  if (status === 409 && bodyCode(data) === "library_slot_conflict") return "slot_taken";
  // This refusal carries no code, only its message, so that is what it is
  // recognized by.
  if (status === 400 && /not catalogued in the selected genre/i.test(serverMessage(data) ?? "")) {
    return "artist_not_in_genre";
  }
  return undefined;
}

/**
 * True for the two `updateAlbum` refusals this module words for every screen
 * that sends the write, which `updateAlbum` marks expected so the shared
 * error middleware neither toasts the raw server text nor reports a normal
 * librarian outcome as a fault.
 */
export function isExpectedReleaseSaveRefusal(response: { status?: unknown; data?: unknown }): boolean {
  return refusalReason(response.status, response.data) !== undefined;
}

const SLOT_TAKEN_FIX = {
  editor: " Change the Release Call Number on this page and save again.",
  move: " Open View/Modify/Delete this Library Release to change its Release Call Number, then move it again.",
} as const;

/** Interprets a rejected `updateAlbum` that moved the release to another genre; never throws on an unexpected body. */
export function interpretReleaseSaveError(err: unknown, context: ReleaseSaveContext): ReleaseSaveRefusal {
  const { screen, genreName, callNumber, artistName, variousArtists } = context;
  const generic: ReleaseSaveRefusal = { reason: "generic", message: FALLBACK_MESSAGES[screen] };
  const answer = unwrapEndpointErrorOrRaw("updateAlbumError", err);
  if (!answer || !genreName) return generic;
  const reason = refusalReason(answer.status, answer.data);

  if (reason === "slot_taken") {
    // The modern editor has no call number field to send the librarian to.
    const message =
      screen === "modern"
        ? `${genreName} already has a release at number ${callNumber}, so this release can't be moved there.`
        : `${genreName} already has a release at number ${callNumber}.${SLOT_TAKEN_FIX[screen]}`;
    return { reason, message };
  }
  if (reason === "artist_not_in_genre") {
    if (!variousArtists) {
      return {
        reason,
        message: `${artistName} isn't filed under ${genreName} yet. File the artist under ${genreName} first, then move this release.`,
      };
    }
    // A compilation's artist row is a shelf section, not a performer, so
    // filing it under a new genre is not the librarian's fix to make here.
    const fix =
      screen === "modern"
        ? ""
        : " Use Change the Library Code of This Library Release to file it under a different artist.";
    return {
      reason,
      message: `${artistName} isn't filed under ${genreName}, so this release can't be moved there.${fix}`,
    };
  }
  return generic;
}
