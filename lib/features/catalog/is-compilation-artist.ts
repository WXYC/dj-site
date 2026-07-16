// Keep COMPILATION_KEYWORDS / isCompilationArtistName in sync with
// apps/backend/services/requestLine/matching/compilation.ts. The stricter
// isCompilationReleaseArtistName below is dj-site-only and has no backend twin.
const COMPILATION_KEYWORDS = [
  "various",
  "soundtrack",
  "compilation",
  "v/a",
  "v.a.",
];

/**
 * Lenient substring compilation hint for the read-only search-hint consumers
 * (useGhostText, catalogHooks, useLmlLibrarySearch), where a false positive
 * only widens a search. Do NOT gate the rotation artist WRITE on this: the
 * unbounded `.includes` also matches single artists whose name merely contains
 * a keyword. Use isCompilationReleaseArtistName for the write gate.
 */
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

// Whole-name compilation designations for the write gate: anchored to the
// entire normalized name, not a substring or token scan, so a band name that
// embeds a keyword as a real word does not qualify.
const COMPILATION_ARTIST_PATTERNS: readonly RegExp[] = [
  /^various(\s+artists?)?$/, //            "Various", "Various Artist(s)"
  /^v\s*[/.]\s*a\.?$/, //                  "V/A", "V.A.", "V / A"
  /^(original\s+)?(motion\s+picture\s+)?soundtrack$/, // "Soundtrack", "Original Soundtrack", "Original Motion Picture Soundtrack"
  /^ost$/, //                             common soundtrack abbreviation
  /^compilation$/,
];

/**
 * Strict, whole-name compilation predicate for the rotation artist WRITE gate,
 * decoupled from the lenient COMPILATION_KEYWORDS search-hint list.
 *
 * Name-only detection is lossy; residual gaps this does not cover:
 *  - Localized or non-canonical V/A strings ("Verschiedene", "Diverse",
 *    "Sampler") are not recognized and will not auto-fill.
 *  - Compilations filed under a credited album artist (e.g. a DJ-mix under the
 *    mixer's name) are only caught via `album_artist`, below.
 *  - Splits filed under one band's name keep the release-level artist.
 * The deterministic marker is `album_artist` on the rotation wire; BS's
 * getRotationFromDB does not yet emit it, so this name heuristic is the interim
 * gate. No backend twin: the backend matcher serves request-line parsing, which
 * tolerates a different false-positive rate.
 */
export function isCompilationReleaseArtistName(
  artist: string | null | undefined
): boolean {
  if (!artist) return false;
  const normalized = artist.trim().toLowerCase().replace(/\s+/g, " ");
  return COMPILATION_ARTIST_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Release-level compilation/V-A predicate: true when `album_artist` is
 * populated (schema: "Credited album artist for compilations") or the artist
 * name is a compilation designation. The name check routes through the strict
 * isCompilationReleaseArtistName, not the lenient search-hint list.
 *
 * BS's GET /library/rotation does not currently emit `album_artist`
 * (getRotationFromDB omits the column), so rotation rows are gated on the name
 * heuristic alone until that column is wired through.
 */
export function isCompilationRelease(release: {
  album_artist?: string;
  artist?: { name?: string | null } | null;
}): boolean {
  return (
    !!release.album_artist ||
    isCompilationReleaseArtistName(release.artist?.name)
  );
}
