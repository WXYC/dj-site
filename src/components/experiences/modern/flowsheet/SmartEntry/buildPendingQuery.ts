import type { FlowsheetQuery, SelectedMatch } from "@/lib/features/flowsheet/types";

/**
 * Does the user's typed value still agree with the selected match's canonical
 * value? True when the typed text is empty or a case-insensitive prefix of the
 * canonical value. Once the DJ edits past the prefix (e.g. types a different
 * artist), the match no longer applies and should be deselected.
 */
function fieldAgrees(typed: string, canonical: string): boolean {
  if (typed === "") return true;
  return canonical.toLowerCase().startsWith(typed.trim().toLowerCase());
}

/**
 * Whether a selected match still applies to the current typed query. The
 * identity fields (artist, album) must both still agree; the smart-entry hook
 * calls this on every edit and clears the selection when it returns false,
 * which is the anti-clobber rule: editing artist/album past the match drops the
 * result-supplied values instead of fighting the DJ's text.
 */
export function selectedMatchApplies(
  query: FlowsheetQuery,
  match: SelectedMatch
): boolean {
  return (
    fieldAgrees(query.artist, match.artist) &&
    fieldAgrees(query.album, match.album)
  );
}

/**
 * Build the effective pending flowsheet entry from the user-authored query and
 * the (optional) selected catalog/rotation match.
 *
 *  - `song` is always user-authored — a result never supplies it.
 *  - `artist`/`album` snap to the match's canonical value while the match
 *    applies; the album_id/rotation linkage rides along. When the match no
 *    longer applies (or there is none), the typed text and the query's own
 *    linkage stand as-is.
 *  - `label` is freeform: the user's text wins, falling back to the match's.
 *
 * The result feeds `convertQueryToSubmission` unchanged, so the #701 `album_id
 * > 0` gate keeps protecting the wire.
 */
export function buildPendingQuery(
  query: FlowsheetQuery,
  selectedMatch: SelectedMatch | null
): FlowsheetQuery {
  if (!selectedMatch || !selectedMatchApplies(query, selectedMatch)) {
    return { ...query };
  }

  const label = query.label.trim() !== "" ? query.label : selectedMatch.label;

  return {
    ...query,
    artist: selectedMatch.artist,
    album: selectedMatch.album,
    label,
    album_id: selectedMatch.album_id,
    rotation_id: selectedMatch.rotation_id,
    rotation_bin: selectedMatch.rotation_bin,
  };
}
