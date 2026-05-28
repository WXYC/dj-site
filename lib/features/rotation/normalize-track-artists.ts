// Discogs disambiguates two artists sharing a name with a parenthesized
// numeric suffix (e.g. "M.I.A. (2)" for the rapper vs. the older artist).
// LML's release_track_artist read path forwards the raw name, so the suffix
// surfaces to dj-site verbatim. We strip it before display and before writing
// to the Redux artist field — DJs don't want to see "(2)" in the flowsheet.
const DISCOGS_DISAMBIG_SUFFIX = /\s*\(\d+\)\s*$/;

/**
 * Clean and dedupe a track's per-artist credits.
 *
 * Discogs returns artists per-track-credit (Producer, Co-writer, Member, etc.)
 * with no role column on `release_track_artist`, so the same artist can appear
 * multiple times — "Warrior, Warrior" reaches the dj-site for any track where
 * the same person holds two roles. Compounding that, the LML cache table has
 * no unique constraint (6,973 duplicate rows / 144 releases in prod as of
 * 2026-05-25), so even a single-role artist can show up multiple times.
 *
 * This helper folds three normalizations the picker needs:
 *  - strip Discogs `" (N)"` disambig suffix
 *  - trim and drop empty entries
 *  - dedupe by the cleaned name, preserving first-occurrence order
 *
 * Defensive against null/undefined/non-string entries so a malformed LML
 * response can't crash the picker (V/A pre-`46c0c5f` partial-write rows
 * occasionally surface unexpected shapes).
 */
export function normalizeTrackArtists(
  raw: readonly unknown[] | null | undefined
): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of raw) {
    if (typeof name !== "string") continue;
    const cleaned = name.replace(DISCOGS_DISAMBIG_SUFFIX, "").trim();
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}
