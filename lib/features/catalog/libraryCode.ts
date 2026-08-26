/**
 * Shelf-code rendering for the classic librarian screens, reproducing
 * tubafrenzy's four formatters rule-for-rule:
 *
 * - `ArtistLibraryCode.getCallLettersAndNumbers()` (`:85`)
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
 * True for a Various Artists bucket.
 *
 * Two spellings, because two systems store this differently and only one of
 * them is upstream of this client:
 *
 * - **`V/A`** is what Backend-Service actually serves. The catalog import
 *   rewrites `Z-<letter>` to the literal `V/A` on the way in, so this is the
 *   form every compilation on the shelf arrives in — 53 artist rows over
 *   ~6,300 releases. Matched case- and whitespace-insensitively, since the
 *   legacy catalog is what supplied these values.
 * - **`Z-<letter>`** is the legacy spelling, the one
 *   `ArtistLibraryCode.isVariousArtists()` tests. Kept so a value predating or
 *   bypassing that rewrite still reads as a compilation rather than as an
 *   artist whose name happens to start with `Z-`.
 *
 * Structural, never a test on the artist's name: the shelf holds
 * `Various Artists`, `Various Artists - Rock - <A-Z>`, and
 * `Soundtracks - <A-Z>`, and the last of those contains no "various" at all.
 */
export function isVariousArtists(codeLetters: string): boolean {
  const trimmed = codeLetters.trim();
  return trimmed.toUpperCase() === "V/A" || trimmed.startsWith("Z-");
}

/**
 * The artist half of a call number, with no trailing punctuation: `MO 12`
 * for a named artist, `V/A` for a compilation bucket.
 *
 * Unlike `formatArtistCodeWithPunctuation`, this never recovers a
 * Rock/Soundtracks sub-bucket letter (`X-`) from the legacy `Z-<letter>`
 * spelling: `multipleArtistsDisplay.jsp`, the one screen that renders this
 * exact getter, only ever receives rows Backend-Service already collapsed to
 * the literal `V/A` — see this file's header — so there is no sub-bucket
 * letter left to recover by the time a caller here holds one.
 */
export function formatCallLettersAndNumbers({
  code_letters,
  code_artist_number,
}: Pick<ArtistCodeParts, "code_letters" | "code_artist_number">): string {
  if (isVariousArtists(code_letters)) {
    return "V/A";
  }
  return `${code_letters.toUpperCase()} ${code_artist_number}`;
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
    // prefix, which is the Soundtracks sub-bucket letter.
    //
    // Reachable only on the legacy `Z-<letter>` spelling. The `V/A` form
    // Backend-Service serves has already lost that letter — the import
    // collapses every `Z-<letter>` to the same three characters. It survives
    // in the artist's NAME (`Soundtracks - K`), which this screen shows in its
    // heading, so the sub-bucket stays legible to a librarian; it is simply
    // not recoverable from the code, and digging it back out of the name is
    // the name-matching this file exists to avoid.
    const bucket =
      genre_id === SOUNDTRACKS_GENRE_ID && trimmed.startsWith("Z-")
        ? trimmed.substring(2, 3)
        : "V/A";
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
