import type { CompilationTrackInput } from "./types";

/**
 * The server's uniqueness key for a per-track credit: artist and title,
 * serialized together so `("Cat", "Power Ballad")` and `("Cat Power",
 * "Ballad")` stay distinct — a joined plain string risks exactly that
 * collision no matter which separator is picked, since both fields are
 * free text a librarian can type anything into. `JSON.stringify` on the pair
 * sidesteps the separator question entirely rather than picking one
 * character and hoping no title ever contains it. `track_position` is
 * deliberately excluded — it is data, not key, so two rows differing only in
 * position are one credit to `POST /:libraryId/compilation-tracks`, and the
 * second is skipped rather than filed.
 *
 * Both the modern add-release flow (`VaTracklistStep`) and classic's release
 * tracklist editor write against this same additive-only endpoint and have to
 * agree with its dedupe rule — to avoid offering as "new" a row the server
 * will silently skip, or losing track of a row it will silently duplicate
 * under a corrected spelling. One definition here rather than two
 * independently-maintained copies of a rule that is really the backend's.
 */
export function compilationTrackCreditKey(track: CompilationTrackInput): string {
  return JSON.stringify([track.artist_name.trim(), track.track_title?.trim() ?? ""]);
}
