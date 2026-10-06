/**
 * Shelf-code rendering for the classic librarian screens, reproducing
 * tubafrenzy's four formatters:
 *
 * - `ArtistLibraryCode.getCallLettersAndNumbers()` (`:85`)
 * - `ArtistLibraryCode.getCallLettersAndNumbersWithPunctuation()` (`:98`)
 * - `LibraryRelease.getCallNumbersAndLetters()` (`:122`)
 * - `LibraryRelease.getEntireLibraryCode()` (`:129`)
 * - `LibraryRelease.getPreferredArtistString()` (`:138`)
 * - `LibraryRelease.getEntireArtistTitleString()` (`:145`)
 *
 * Rule-for-rule, with three named divergences. (1) The Java recovers a Various Artists sub-bucket letter by
 * substring-ing the legacy `Z-<letter>` spelling; the `V/A` form Backend-Service
 * serves has lost that spelling, so the letter comes from the structural
 * `code_comp_letter` instead (see `compilationSectionLetter`) -- never from
 * the artist's name. (2) A Rock `Z--` (a compilation slot with no section
 * letter) renders `V/A-<n>`, matching Backend and LML, where the Java's
 * `substring(2, 3)` would give `V/A --<n>`. (3) `formatReleaseCode` trims a
 * padded volume letter, as Backend and wxyc-catalog do, where the Java does not.
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

import type { AlbumEntry } from "./types";
import { isRockCompLettersRequired } from "./chooserValidation";

/**
 * `GenreId.ROCK`. Hardcoded rather than resolved by name, matching
 * `chooserValidation.isRockCompLettersRequired` (which owns the Rock +
 * Soundtracks pair of genres that carry a sub-bucket letter) for the same
 * reason: the JSPs branch on the id, and a genre rename upstream must not
 * silently change how a shelf code renders.
 */
const ROCK_GENRE_ID = 11;

export type ArtistCodeParts = {
  code_letters: string;
  /**
   * Null for an artist with no `genre_artist_crossreference` row. Only
   * `GET /library/crossreferences/releases` can serve one — it LEFT joins that
   * table so a frozen legacy cross-reference can never silently vanish from a
   * listing nothing else in the system reproduces. Every other endpoint INNER
   * joins it and always has a number.
   */
  code_artist_number: number | null;
  /**
   * `undefined` for a caller that never resolved (or never carried) which
   * genre this code is scoped to — a response predating the field, or a
   * screen with no genre list loaded yet. The Rock/Soundtracks Various-Artists dispatch in
   * `formatArtistCodeWithPunctuation` and `formatCallLettersAndNumbers`, and the
   * avatar badge, read this; an unresolved value must fall through to the generic bucket rather
   * than coincidentally matching one of the two hardcoded ids.
   */
  genre_id: number | null | undefined;
  /**
   * The Rock/Soundtracks compilation section letter Backend-Service serves
   * structurally beside the artist number. `null` or `undefined` for a source
   * that carries none (an LML-only row, a response predating the field, a
   * filing that created the artist) -- either renders the letterless `V/A`. Read only for a compilation
   * in Rock or Soundtracks; never derived from the artist's name.
   */
  code_comp_letter: string | null | undefined;
};

export type ReleaseCodeParts = {
  code_number: number;
  /**
   * `null` is a release with no volume letters; `undefined` mirrors
   * `AlbumEntry.code_volume_letters` -- a source that carries no such column
   * at all (an LML-only search row). `formatReleaseCode` treats
   * both the same way: either is "no volume letter to render."
   */
  code_volume_letters: string | null | undefined;
};

/**
 * The one code every Various Artists bucket is filed under once the catalog
 * import has run, in every genre. The data-model fact behind the collapse
 * documented on `isVariousArtists` below, exported so the code search and the
 * formatters compose one literal rather than four.
 */
export const VARIOUS_ARTISTS_CODE_LETTERS = "V/A";

/**
 * The one call number every Various Artists bucket is filed at, in every
 * genre — the other half of the compilation shelf's code, so it lives beside
 * the letters rather than apart from them. The JSP composed a genre-specific
 * key instead — `Z-<letter>` from `rockCompLetters` for Rock and Soundtracks,
 * the literal `Z--` for every other genre — and the catalog import preserves
 * neither spelling, so neither can narrow a search.
 *
 * Every compilation bucket in a genre therefore collides on this one triple,
 * which is the disambiguation screen's actual production trigger:
 * `V/A`/12/0 has 27 owners and `V/A`/11/0 has 26 in the current catalog. A
 * lookup at this pair answers with the genre's whole bucket set, never one
 * bucket, and the sub-bucket letter is served structurally as `code_comp_letter`
 * (see `compilationSectionLetter`); it is not derived from the artist's name.
 */
export const VARIOUS_ARTISTS_CODE_NUMBER = 0;

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
  return trimmed.toUpperCase() === VARIOUS_ARTISTS_CODE_LETTERS || trimmed.startsWith("Z-");
}

/**
 * A Various Artists bucket's section letter, or `""` when it has none to show.
 * The letter is read from the legacy `Z-<letter>` spelling
 * (`callLetters.substring(2, 3)`, as the Java does) or else from
 * `code_comp_letter`, the structural field Backend-Service serves for the
 * collapsed `V/A` form -- never from the artist's name. A `-` after `Z-` is
 * the empty-section spelling (`Z--`), not a letter. Only Rock and Soundtracks
 * carry one. Also the badge's number-slot content, so the call number and the
 * avatars cannot disagree about which compilations have a letter.
 */
export function compilationSectionLetter({
  code_letters,
  genre_id,
  code_comp_letter,
}: Pick<ArtistCodeParts, "code_letters" | "genre_id" | "code_comp_letter">): string {
  const trimmed = code_letters.trim();
  const legacy = trimmed.startsWith("Z-") ? trimmed.substring(2, 3) : "";
  const letter = legacy !== "" && legacy !== "-" ? legacy : (code_comp_letter?.trim().toUpperCase() ?? "");
  return isRockCompLettersRequired(genre_id ?? null) ? letter : "";
}

/** A Various Artists bucket's call-letters label: `V/A <L>` (Rock), `<L>` (Soundtracks), else `V/A`. */
function compilationLabel(parts: Pick<ArtistCodeParts, "code_letters" | "genre_id" | "code_comp_letter">): string {
  const letter = compilationSectionLetter(parts);
  if (letter === "") {
    return VARIOUS_ARTISTS_CODE_LETTERS;
  }
  return parts.genre_id === ROCK_GENRE_ID ? `${VARIOUS_ARTISTS_CODE_LETTERS} ${letter}` : letter;
}

/**
 * The artist half of a call number, with no trailing punctuation: `MO 12`
 * for a named artist, `V/A` for a compilation bucket, and the letters alone
 * for an artist that carries no genre code at all.
 *
 * A Various Artists bucket splits three ways off `genre_id`, as the Java does:
 * `V/A <letter>` for Rock, the bare `<letter>` for Soundtracks, and `V/A` for
 * every other genre or a bucket with no letter. See `compilationLabel` for
 * where the letter comes from.
 */
export function formatCallLettersAndNumbers({
  code_letters,
  code_artist_number,
  genre_id,
  code_comp_letter,
}: Pick<
  ArtistCodeParts,
  "code_letters" | "code_artist_number" | "genre_id" | "code_comp_letter"
>): string {
  if (isVariousArtists(code_letters)) {
    return compilationLabel({ code_letters, genre_id, code_comp_letter });
  }
  // A bucket never carried a number, so the branch above needs none; an
  // ordinary code with no genre row has only its letters left, and those are
  // still enough to walk to the right shelf section.
  if (code_artist_number === null) {
    return code_letters.trim().toUpperCase();
  }
  return `${code_letters.toUpperCase()} ${code_artist_number}`;
}

/**
 * The artist half of a call number with the genre word the JSP's
 * `fullLibraryCode` prefixes -- `Jazz EL 12`. The artist-card analogue of
 * `formatEntireLibraryCode`, for the screens that render an artist's own
 * filing with no release half.
 *
 * `genreName` is optional for the same reason it is there: it is resolved from
 * the genres list, which can be in flight, and `EL 12` is still enough to walk
 * to the shelf.
 *
 * A compilation bucket takes NO genre word, matching `artistCardHref`'s rule
 * for the card the same code links to. A bucket is a shelf section rather than
 * a performer -- `Various Artists` is filed under 14 genres -- so there is no
 * one membership to name, and the number this word would qualify was already
 * dropped by the line above. Naming one anyway would pick a genre off an
 * artist that spans them all.
 */
export function formatArtistLibraryCode({
  genreName,
  code_letters,
  code_artist_number,
}: Pick<ArtistCodeParts, "code_letters" | "code_artist_number"> & {
  genreName?: string;
}): string {
  const code = formatCallLettersAndNumbers({
    code_letters,
    code_artist_number,
    genre_id: undefined,
    code_comp_letter: null,
  });
  if (!genreName || isVariousArtists(code_letters)) {
    return code;
  }
  return `${genreName} ${code}`;
}

/**
 * The artist half of a call number, with its trailing punctuation: `MO 12/`
 * for a named artist, `V/A-` for a compilation bucket in any other genre,
 * `V/A X-` for a Rock compilation's sub-bucket, and the bare sub-bucket
 * letter (`X-`) for a Soundtracks compilation — Rock keeps the `V/A` word
 * ahead of its letter where Soundtracks drops it, matching
 * `ArtistLibraryCode.getCallLettersAndNumbersWithPunctuation()`.
 *
 * The V/A branches drop `code_artist_number` entirely — that is the Java's
 * behavior, not an omission: a compilation bucket is filed by its letter, so
 * the artist number never reaches the shelf.
 */
export function formatArtistCodeWithPunctuation(parts: ArtistCodeParts): string {
  if (isVariousArtists(parts.code_letters)) {
    return `${compilationLabel(parts)}-`;
  }
  // The named-artist form is the same string the no-punctuation getter
  // renders, which is how the Java relates the two -- delegated so the pair
  // cannot drift into disagreeing about a code neither branch calls V/A.
  return `${formatCallLettersAndNumbers(parts)}/`;
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
  const letters = code_volume_letters?.trim().toUpperCase();
  return letters ? `${code_number}-${letters}` : String(code_number);
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

/**
 * `formatEntireLibraryCode` over an `AlbumEntry`, the shape every catalog,
 * flowsheet-search and bin row is converted to -- one mapping from its field
 * names to the formatter's, so no surface can drop `genre_id` or the volume
 * letters and quietly render a different code from the rest. `genreName` is
 * opt-in because most of those surfaces show the genre elsewhere on the row.
 *
 * `artist` is read optionally despite its type: search and flowsheet rows
 * with a null artist do reach these surfaces, and the row must still render.
 */
export function formatAlbumEntryLibraryCode(album: AlbumEntry, genreName?: string): string {
  return formatEntireLibraryCode({
    genreName,
    code_letters: album.artist?.lettercode ?? "",
    code_artist_number: album.artist?.numbercode ?? null,
    genre_id: album.artist?.genre_id,
    code_comp_letter: album.artist?.code_comp_letter,
    code_number: album.entry,
    code_volume_letters: album.code_volume_letters,
  });
}

export type ReleaseArtistTitleParts = {
  /** `library.alternate_artist_name` -- the release's own credit, if it has one. */
  alternate_artist_name: string | null;
  /** Whoever the release is filed under, which is a different artist on a compilation. */
  album_artist_name: string | null;
  album_title: string;
};

/**
 * `getEntireArtistTitleString()`: the artist a release is presented under,
 * then its title. `getPreferredArtistString()` supplies the first half and
 * tests the alternate credit with `isBlank()`, so a whitespace-only value
 * falls through to the filed artist rather than rendering as an empty name.
 *
 * The Java always has a filed artist to fall back on because it reads one off
 * a joined row; this client's wire types leave it nullable. A dangling
 * " - Title" would read as a release whose artist failed to render, so a row
 * with neither name renders its title alone.
 */
export function formatReleaseArtistTitle({
  alternate_artist_name,
  album_artist_name,
  album_title,
}: ReleaseArtistTitleParts): string {
  const artist =
    alternate_artist_name && alternate_artist_name.trim() !== ""
      ? alternate_artist_name
      : album_artist_name;
  return artist ? `${artist} - ${album_title}` : album_title;
}
