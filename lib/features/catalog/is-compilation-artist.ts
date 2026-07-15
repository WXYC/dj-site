// Keep in sync with apps/backend/services/requestLine/matching/compilation.ts.
const COMPILATION_KEYWORDS = [
  "various",
  "soundtrack",
  "compilation",
  "v/a",
  "v.a.",
];

export function isCompilationArtistName(
  artist: string | null | undefined
): boolean {
  if (!artist) return false;
  const lower = artist.toLowerCase();
  for (const keyword of COMPILATION_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }
  return false;
}

/**
 * Release-level compilation/V-A predicate: `album_artist` populated (the
 * schema marks it "Credited album artist for compilations") or a V/A-shaped
 * artist name.
 *
 * Consumers include the rotation picker's artist auto-fill gate (#763),
 * which uses a `true` here to decide that Discogs per-track credits are
 * performer names safe to WRITE to the flowsheet — a keyword added above
 * for a search-hint use case widens that write gate too. Note BS's
 * `GET /library/rotation` does not currently emit `album_artist`
 * (getRotationFromDB's SELECT omits it), so rotation rows are gated by
 * artist name alone until BS wires the column through.
 */
export function isCompilationRelease(release: {
  album_artist?: string;
  artist?: { name?: string | null } | null;
}): boolean {
  return !!release.album_artist || isCompilationArtistName(release.artist?.name);
}
