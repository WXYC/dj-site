import {
  parseReleaseCodeNumber,
  releaseVolumeLettersTooLong,
} from "@/lib/features/catalog/adminCreateArtistValidation";

/**
 * The confirmation the import screen carries onto the artist card it lands on,
 * and the parts of it that travel in the URL.
 *
 * Only a rotation id, a call number, and a short volume-letters string cross
 * -- never free text -- and the sentence is assembled here from the card's
 * own artist data. The card pages state the rule this follows: a message
 * taken from the URL as text would let any link put arbitrary words in the
 * station's voice at the top of a catalog screen, and a shelf code is data
 * the card can compose for itself. `volumeLettersReadable` below is the other
 * half of that guarantee: it bounds which code points the volume-letters
 * string itself may contain, so a URL cannot use that string to smuggle a
 * bidi override or similar into the sentence.
 *
 * This shape is wider than what either card actually renders --
 * `{ codeNumber: undefined, volumeLetters: "A" }` type-checks -- but both
 * `ArtistCard` and `VariousArtistsCard` gate the whole code clause on
 * `codeNumber != null`, so that combination is never shown.
 */
export type ImportedReleaseParams = {
  rotationId: number;
  codeNumber?: number;
  volumeLetters?: string;
};

/**
 * Bidi and other format/control code points (Cc, Cf) can steer how the rest
 * of the sentence renders -- a right-to-left override (U+202E) can make it
 * read in an order different from how it's stored -- and a combining mark (M)
 * can silently alter the glyph next to it. Both are undetectable at a glance
 * on the one screen whose entire purpose is confirming a filing, so neither
 * is readable however short the string is. Digits, letters, slashes, spaces,
 * and punctuation -- what a librarian actually files under, including "V/A"
 * and "??" -- all stay readable.
 */
const UNREADABLE_CODE_POINT = /[\p{Cc}\p{Cf}\p{M}]/u;

/**
 * `library.code_volume_letters` is `varchar(4)`; length is the only bound the
 * server applies (`validateCodeVolumeLetters`), and `releaseVolumeLettersTooLong`
 * matches it client-side at filing time, so this defers to that helper rather
 * than re-deriving the ceiling from the raw constant. A charset check beyond
 * that would disagree with what the filing forms actually store -- except for
 * the code points `UNREADABLE_CODE_POINT` excludes, which no filing form's
 * charset check screens out today but none of them can be typed as an
 * intentional call number either.
 */
function volumeLettersReadable(vol: string): boolean {
  return !releaseVolumeLettersTooLong(vol) && !UNREADABLE_CODE_POINT.test(vol);
}

/**
 * Reads the `imported` / `code` / `vol` triple off a card URL, or `undefined`
 * when the landing was not an import. A `vol` longer than the column can
 * hold, or carrying a code point `volumeLettersReadable` refuses, did not
 * come from a successful save, so it is dropped -- and `codeNumber` is
 * dropped with it, not just the letters, so the confirmation never states a
 * shelf code with its volume letters silently missing. `code` is parsed with
 * `parseReleaseCodeNumber`, the same call-number rule the filing forms
 * themselves enforce, so this can't state a call number no filing rule would
 * have accepted.
 */
export function parseImportedReleaseParams(
  imported: string | undefined,
  code: string | undefined,
  vol: string | undefined,
): ImportedReleaseParams | undefined {
  const rotationId = Number(imported);
  if (!Number.isInteger(rotationId) || rotationId <= 0) return undefined;
  const codeNumber = code !== undefined ? parseReleaseCodeNumber(code) : null;
  const volumeLettersOk = vol === undefined || volumeLettersReadable(vol);
  return {
    rotationId,
    codeNumber: volumeLettersOk && codeNumber !== null ? codeNumber : undefined,
    volumeLetters: vol && volumeLettersOk ? vol.toUpperCase() : undefined,
  };
}

/**
 * The sentence itself. Names the shelf code the release was filed under and
 * the rotation release it was linked to, because those are the two facts the
 * librarian cannot see anywhere else on the card they just landed on: the code
 * decides where the record physically goes, and the link is the step that
 * silently did not happen for thousands of earlier rows.
 */
export function importedConfirmation(libraryCode: string | null, rotationId: number): string {
  return libraryCode
    ? `Filed as ${libraryCode}, and linked to rotation release #${rotationId}.`
    : `Catalogued and linked to rotation release #${rotationId}.`;
}
