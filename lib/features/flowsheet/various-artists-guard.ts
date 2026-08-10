import { isCompilationReleaseArtistName } from "@/lib/features/catalog/is-compilation-artist";

/**
 * Compilation credits the flowsheet refuses on top of the shared release-artist
 * set. Both are deliberately absent from COMPILATION_ARTIST_PATTERNS, where a
 * false positive would push a real single artist into the catalog's per-track
 * capture step; in the artist field of a flowsheet entry they are only ever
 * shorthand for the compilation credit. Mirrors tubafrenzy's `isVariousArtists`
 * (flowsheet-form-controller.ts), which has refused both for years.
 */
const ABBREVIATED_COMPILATION_CREDITS: readonly RegExp[] = [
  /^v[\s./]*a\.?$/, //      "VA", "V A", "V/A", "V.A."
  /^var\.?\s+artists?$/, // "Var. Artists", "Var Artist"
];

/**
 * Copy for every refusal, in both experiences. Names the fix rather than the
 * rule: the DJ needs to know what to type, not which predicate matched.
 */
export const VARIOUS_ARTISTS_REJECTION_MESSAGE =
  'Use the artist who performed the track, not "Various Artists".';

/**
 * Whole-name predicate for the flowsheet submit block: true when the artist
 * field holds a compilation credit instead of a performer.
 *
 * Stricter than `isCompilationReleaseArtistName` by the two abbreviations
 * above, and applied at a different moment — that predicate classifies a
 * release the catalog already holds, this one refuses a value a DJ is trying
 * to write. Emptiness is not this predicate's business: a blank artist is a
 * separate check each caller already makes.
 */
export function isVariousArtistsEntry(
  artist: string | null | undefined
): boolean {
  if (!artist) return false;
  if (isCompilationReleaseArtistName(artist)) return true;
  const normalized = artist.trim().toLowerCase().replace(/\s+/g, " ");
  return ABBREVIATED_COMPILATION_CREDITS.some((pattern) =>
    pattern.test(normalized)
  );
}
