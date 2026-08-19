/**
 * Shelf-code rendering for the classic librarian screens, reproducing
 * tubafrenzy's three formatters rule-for-rule:
 *
 * - `ArtistLibraryCode.getCallLettersAndNumbersWithPunctuation()` (`:98`)
 * - `LibraryRelease.getCallNumbersAndLetters()` (`:122`)
 * - `LibraryRelease.getEntireLibraryCode()` (`:129`)
 *
 * These are not cosmetic. The composed string is the physical call number a
 * librarian reads off the screen and walks to the stacks with, so its
 * punctuation is part of the catalog's meaning rather than a display choice —
 * which is why the JSPs are the spec here rather than a starting point, and
 * why the pieces live in `lib/` rather than inside one screen.
 *
 * Backend-Service serves the parts, never the composed string: the artist
 * half's `code_letters` comes off `artists` and `code_artist_number` off
 * `genre_artist_crossreference` (it is genre-scoped), while the release half's
 * `code_number` and `code_volume_letters` come off `library`.
 */

/**
 * `GenreId.SOUNDTRACKS`. Hardcoded rather than resolved by name, matching
 * `chooserValidation.isRockCompLettersRequired`, which hardcodes the same id
 * for the same reason: the JSPs branch on the id, and a genre rename upstream
 * must not silently change how a shelf code renders.
 */
const SOUNDTRACKS_GENRE_ID = 12;

export type ArtistCodeParts = {
  code_letters: string;
  code_artist_number: number;
  genre_id: number;
};

export type ReleaseCodeParts = {
  code_number: number;
  code_volume_letters: string | null;
};

/**
 * True for a Various Artists bucket. `ArtistLibraryCode.isVariousArtists()`
 * trims before testing the prefix, so a stored `" Z-X"` is a V/A bucket —
 * reproduced rather than tightened, since the legacy catalog is what supplies
 * these values.
 */
function isVariousArtists(codeLetters: string): boolean {
  return codeLetters.trim().startsWith("Z-");
}

/**
 * The artist half of a call number, with its trailing punctuation: `MO 12/`
 * for a named artist, `V/A-` for a compilation bucket, and the sub-bucket
 * letter alone (`X-`) for a Soundtracks compilation.
 *
 * The V/A branches drop `code_artist_number` entirely — that is the Java's
 * behavior, not an omission: a compilation bucket is filed by its letter, so
 * the artist number never reaches the shelf.
 */
export function formatArtistCodeWithPunctuation({
  code_letters,
  code_artist_number,
  genre_id,
}: ArtistCodeParts): string {
  if (isVariousArtists(code_letters)) {
    const trimmed = code_letters.trim();
    // `callLetters.substring(2, 3)` — the single character after the `Z-`
    // prefix, which is the Rock/Soundtracks sub-bucket letter.
    const bucket = genre_id === SOUNDTRACKS_GENRE_ID ? trimmed.substring(2, 3) : "V/A";
    return `${bucket}-`;
  }
  return `${code_letters.toUpperCase()} ${code_artist_number}/`;
}

/**
 * The release half of a call number: the number alone, or `NUMBER-LETTERS`
 * when the release carries volume letters. Blank-not-empty is the Java's test
 * (`isBlank()`), so a whitespace-only value renders as no volume letter rather
 * than as a trailing hyphen.
 */
export function formatReleaseCode({
  code_number,
  code_volume_letters,
}: ReleaseCodeParts): string {
  if (!code_volume_letters || code_volume_letters.trim() === "") {
    return String(code_number);
  }
  return `${code_number}-${code_volume_letters.toUpperCase()}`;
}

/**
 * The whole call number as the artist card's release table renders it:
 * genre name, a space, the artist half, then the release half with no
 * separator — `getEntireLibraryCode()`.
 *
 * `genreName` is optional because it is resolved from the genres list, which
 * can be in flight or unavailable. When it is missing the prefix is dropped
 * and the rest of the code still renders: a librarian can find a record from
 * `MO 12/5` without the genre word, and withholding the whole cell would be a
 * worse answer than an incomplete one.
 */
export function formatEntireLibraryCode({
  genreName,
  ...parts
}: ArtistCodeParts & ReleaseCodeParts & { genreName?: string }): string {
  const code = `${formatArtistCodeWithPunctuation(parts)}${formatReleaseCode(parts)}`;
  return genreName ? `${genreName} ${code}` : code;
}
