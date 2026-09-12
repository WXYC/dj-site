import { isCompilationReleaseArtistName } from "../catalog/is-compilation-artist";
import { formatArtistCodeWithPunctuation } from "../catalog/libraryCode";

/**
 * The call letters every compilation bucket is suggested under.
 * `RotationRelease.suggestCallLetters()` returns this literal for a Various
 * Artists row, and the shelf keeps the legacy `Z-<letter>` spelling in front
 * of a librarian even though the catalog import collapses it to `V/A`.
 */
export const VARIOUS_ARTISTS_SUGGESTED_CALL_LETTERS = "Z-";

/**
 * Shown beside the suggested call letters, and not optional chrome.
 *
 * `RotationRelease.suggestCallLetters()` derives its two letters from the
 * artist's *alphabetical* name, which is the filing name — "Molina, Juana"
 * gives `mo`, not `ju`. A rotation row has no alphabetical name and no column
 * to hold one, so this derives from the presentation name instead and will be
 * wrong for exactly the names whose filing order differs from their billing
 * order. Saying so is the difference between a suggestion and a silent
 * misfiling.
 */
export const CALL_LETTERS_ADVISORY =
  "Suggested from the artist's presentation name. A name that files differently from how it is billed — “Juana Molina” under MO — needs correcting by hand.";

/**
 * `RotationRelease.suggestCallLetters()`: the first two characters of the
 * filing name, lowercased, or the compilation bucket's letters.
 *
 * The compilation test is `isCompilationReleaseArtistName`, this codebase's
 * strict whole-name predicate, rather than a second transcription of the
 * Java's own regex. It is deliberately wider: it also recognizes
 * "Soundtrack", "OST" and "Compilation", which file in the same buckets at
 * WXYC and which the Java's narrower test would have sent to `so`, `os` and
 * `co`.
 */
export function suggestCallLetters(presentationName: string | null | undefined): string {
  if (isCompilationReleaseArtistName(presentationName)) {
    return VARIOUS_ARTISTS_SUGGESTED_CALL_LETTERS;
  }
  const name = (presentationName ?? "").trim();
  if (name === "") return "";
  return name.substring(0, 2).toLowerCase();
}

/**
 * The artist half of a shelf code as the import screen prints it:
 * `Electronic CHU 12/`, matching `rotationReleaseImport.jsp`'s
 * `genreName` + `callLettersAndNumbersWithPunctuation` pair.
 *
 * The genre word is dropped when the row does not carry one. The contract
 * declares `genre_name` optional even though Backend joins it INNER in both
 * search modes, and `MO 12/` still names the shelf section — withholding the
 * whole code would be a worse answer than an incomplete one.
 */
export function artistShelfCode(match: {
  code_letters: string;
  code_number: number;
  genre_id?: number | null;
  genre_name?: string | null;
}): string {
  const code = formatArtistCodeWithPunctuation({
    code_letters: match.code_letters,
    code_artist_number: match.code_number,
    genre_id: match.genre_id ?? 0,
  });
  return match.genre_name ? `${match.genre_name} ${code}` : code;
}
