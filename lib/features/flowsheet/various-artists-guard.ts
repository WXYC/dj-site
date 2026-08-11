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
 * The remedy appended to the mail bin's Play Now refusals. Play Now is a
 * single click with no artist field to satisfy the refusal in place, unlike
 * every other refusal surface — so those messages have to name a different
 * remedy: queue it, then name the performer in the now-editable queue row.
 */
const BIN_PLAY_QUEUE_REMEDY =
  " Add it to the queue instead, then type the performer into the artist cell before playing it.";

/** Copy for the mail bin's Play Now refusal of a compilation credit. */
export const VARIOUS_ARTISTS_BIN_PLAY_MESSAGE = `${VARIOUS_ARTISTS_REJECTION_MESSAGE}${BIN_PLAY_QUEUE_REMEDY}`;

/**
 * Copy for a blank artist, which is a different mistake from a refused
 * credit and must not borrow its message: a DJ who left the field empty
 * never typed "Various Artists", so telling them not to names a fix they
 * did not need. Emptiness is legal in the queue and refused only at the
 * flowsheet boundary, so this fires later than the credit refusal does.
 */
export const MISSING_ARTIST_REJECTION_MESSAGE =
  "Name the artist who performed the track.";

/**
 * Copy for the mail bin's Play Now refusal when the release carries no
 * credit at all. Same dead end as the compilation credit and the same
 * remedy, but the DJ never typed a credit to be told off for.
 */
export const MISSING_ARTIST_BIN_PLAY_MESSAGE = `${MISSING_ARTIST_REJECTION_MESSAGE}${BIN_PLAY_QUEUE_REMEDY}`;

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

/**
 * The refusal a flowsheet write earns for its artist value, or `null` when the
 * value is submittable. The flowsheet is the permanent record, so it refuses
 * both a blank artist and a compilation credit — the queue refuses only the
 * latter, because a blank queue row is a draft the DJ can still fill in.
 *
 * The two conditions are mutually exclusive (`isVariousArtistsEntry` is false
 * for every blank and whitespace-only value), so the order here is not
 * load-bearing. They take different copy because they are different mistakes:
 * a DJ who left the field empty never typed "Various Artists", so telling
 * them not to names a fix they did not need.
 */
export function flowsheetArtistRejection(
  artist: string | null | undefined
): string | null {
  if (!artist?.trim()) return MISSING_ARTIST_REJECTION_MESSAGE;
  if (isVariousArtistsEntry(artist)) return VARIOUS_ARTISTS_REJECTION_MESSAGE;
  return null;
}

type ReleaseArtistCredit = { name?: string | null } | null;
type ReleaseCredit = { artist?: ReleaseArtistCredit } | null;

/**
 * True when a release cannot supply its own performing artist, because its
 * credit is one submission refuses.
 *
 * This — not `isCompilationRelease` — is what drives the rotation artist field
 * and the freeform submission routing. The two differ in both directions and
 * each gap is a live bug: a release credited "VA" is refused by the guard but
 * is not an `isCompilationRelease`, so keying on that predicate blanks the
 * field with nothing to refill it; a compilation filed under a credited album
 * artist is an `isCompilationRelease` whose name the guard never refuses, so
 * keying on it strips linkage from an entry that was never in trouble.
 *
 * `isCompilationRelease` stays the right question for per-track credit
 * auto-fill, which is about whether the credits are performers.
 */
export function releaseCreditIsRefused(release: ReleaseCredit): boolean {
  return isVariousArtistsEntry(release?.artist?.name);
}

/**
 * The artist value to seed from a release, or "" when its credit is refused.
 * Never auto-filling a value the form then rejects is what keeps the guard
 * from reading as a bug.
 */
export function seedableArtistName(release: ReleaseCredit): string {
  const name = release?.artist?.name ?? "";
  return isVariousArtistsEntry(name) ? "" : name;
}

/**
 * True when a release leaves the artist field blank — because its credit is
 * refused, or because it carries no credit at all.
 *
 * The two arrive at the same place by different routes, and every surface
 * that has to react to a blank artist cares about the place, not the route:
 * a field is needed to type the performer into, the album linkage must not
 * ride the wire over what gets typed, and the flowsheet refuses the write
 * until it does. `releaseCreditIsRefused` stays the right question only
 * where the compilation credit specifically is the subject — the copy that
 * names it, and the escape hatch that seeds around it.
 */
export function releaseCannotSupplyArtist(release: ReleaseCredit): boolean {
  return seedableArtistName(release).trim() === "";
}

/**
 * Success copy for a release added to the queue, shared by the mail bin and
 * both catalog result surfaces because all three queue through the same
 * conversion.
 *
 * A release that cannot supply an artist is queued blank, so the toast has to
 * say what is still missing — told only "added", the DJ meets the requirement
 * for the first time at the Play refusal, with no idea it was coming. Keyed
 * on what the queue row lacks rather than on the refused credit specifically,
 * because the conversion blanks and unlinks both cases identically.
 */
export function queueAdditionMessage(release: {
  title?: string | null;
  artist?: ReleaseArtistCredit;
}): string {
  const added = `Added ${release.title ?? ""} to queue`;
  return releaseCannotSupplyArtist(release)
    ? `${added}. Name the performer in the artist cell before playing it.`
    : added;
}
