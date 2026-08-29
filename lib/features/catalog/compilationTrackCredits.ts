import type { CompilationTrackInput } from "./types";

/**
 * The server's uniqueness key for a per-track credit, mirrored client-side.
 * `POST /:libraryId/compilation-tracks` dedupes on `(artist_name,
 * track_title)`, so `track_position` is excluded here too: two rows differing
 * only in position are one credit to the endpoint, and the second is skipped
 * rather than filed.
 *
 * Both fields are free text, so the pair is serialized rather than joined —
 * `("Cat", "Power Ballad")` and `("Cat Power", "Ballad")` must stay distinct,
 * and no separator character is safe to assume absent from a title.
 *
 * Every screen that writes to that additive-only endpoint has to agree with
 * this rule, or it offers as new a row the server will silently skip, or loses
 * track of one it will silently duplicate under a corrected spelling. One
 * definition, not one per screen.
 */
export function compilationTrackCreditKey(track: CompilationTrackInput): string {
  return JSON.stringify([track.artist_name.trim(), track.track_title?.trim() ?? ""]);
}
