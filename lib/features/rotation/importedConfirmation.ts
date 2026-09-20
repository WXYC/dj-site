import { RELEASE_VOLUME_LETTERS_MAX_LENGTH } from "@/lib/features/catalog/adminCreateArtistValidation";

/**
 * The confirmation the import screen carries onto the artist card it lands on,
 * and the parts of it that travel in the URL.
 *
 * Only numbers and a short letter string cross, and the sentence is assembled
 * here from the card's own artist data. The card pages state the rule this
 * follows: a message taken from the URL as text would let any link put
 * arbitrary words in the station's voice at the top of a catalog screen, and a
 * shelf code is data the card can compose for itself.
 */
export type ImportedReleaseParams = {
  rotationId: number;
  codeNumber?: number;
  volumeLetters?: string;
};

/**
 * `library.code_volume_letters` is `varchar(4)`; length is the only bound the
 * server applies (`validateCodeVolumeLetters`), and `releaseVolumeLettersTooLong`
 * matches it client-side at filing time. A charset check here would disagree
 * with what the filing forms actually store, so this mirrors the same
 * length-only rule rather than narrowing to letters.
 */
function volumeLettersReadable(vol: string): boolean {
  return Array.from(vol).length <= RELEASE_VOLUME_LETTERS_MAX_LENGTH;
}

/**
 * Reads the `imported` / `code` / `vol` triple off a card URL, or `undefined`
 * when the landing was not an import. A `vol` longer than the column can hold
 * did not come from a successful save, so it is dropped -- and `codeNumber`
 * is dropped with it, not just the letters, so the confirmation never states
 * a shelf code with its volume letters silently missing.
 */
export function parseImportedReleaseParams(
  imported: string | undefined,
  code: string | undefined,
  vol: string | undefined,
): ImportedReleaseParams | undefined {
  const rotationId = Number(imported);
  if (!Number.isInteger(rotationId) || rotationId <= 0) return undefined;
  const codeNumber = Number(code);
  const volumeLettersOk = vol === undefined || volumeLettersReadable(vol);
  return {
    rotationId,
    codeNumber:
      volumeLettersOk && Number.isInteger(codeNumber) && codeNumber > 0
        ? codeNumber
        : undefined,
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
