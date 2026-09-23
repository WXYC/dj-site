import { isVariousArtists } from "./libraryCode";

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
 *    mixer's name) are caught by the shelf rule in `isCompilationRelease`,
 *    never by the credit itself -- see below.
 *  - Splits filed under one band's name keep the release-level artist.
 * The deterministic marker is the shelf (`isVariousArtists(lettercode)`); this
 * name heuristic covers rows that arrive without call letters. No backend
 * twin: the backend matcher serves request-line parsing, which tolerates a
 * different false-positive rate.
 */
export function isCompilationReleaseArtistName(
  artist: string | null | undefined
): boolean {
  if (!artist) return false;
  const normalized = artist.trim().toLowerCase().replace(/\s+/g, " ");
  return COMPILATION_ARTIST_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Release-level compilation/V-A predicate: true when the release is filed on
 * the V/A shelf (`isVariousArtists` over the artist's call letters -- the
 * structural rule) or, for a row that arrives without call letters, when the
 * artist name is a compilation designation. The name check routes through the
 * strict isCompilationReleaseArtistName, not the lenient search-hint list.
 *
 * `album_artist` is deliberately NOT consulted. Until BS#2004 it was written
 * by nothing and NULL on every row, so `!!album_artist` was an unreachable
 * branch; since BS#2004 it is an ordinary librarian-written credit that may
 * sit on a release filed under a named artist -- and treating that as "this
 * is a compilation" would let Discogs contributor credits (producer,
 * co-writer, sample) be trusted as the performing artist on a normal record,
 * which is exactly the #763 corruption the one consumer of this predicate
 * exists to prevent.
 */
export function isCompilationRelease(release: {
  artist?: { name?: string | null; lettercode?: string | null } | null;
}): boolean {
  const letters = release.artist?.lettercode;
  return (
    (typeof letters === "string" && isVariousArtists(letters)) ||
    isCompilationReleaseArtistName(release.artist?.name)
  );
}
