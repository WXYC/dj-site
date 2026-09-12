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

/** `library.code_volume_letters` is `varchar(4)`, and letters are all it holds. */
const VOLUME_LETTERS = /^[A-Za-z]{1,4}$/;

/**
 * Reads the `imported` / `code` / `vol` triple off a card URL, or `undefined`
 * when the landing was not an import. A malformed part is dropped rather than
 * rendered: the confirmation is a statement about what was filed, so a value
 * that cannot be trusted must not appear in it.
 */
export function parseImportedReleaseParams(
  imported: string | undefined,
  code: string | undefined,
  vol: string | undefined,
): ImportedReleaseParams | undefined {
  const rotationId = Number(imported);
  if (!Number.isInteger(rotationId) || rotationId <= 0) return undefined;
  const codeNumber = Number(code);
  return {
    rotationId,
    codeNumber: Number.isInteger(codeNumber) && codeNumber > 0 ? codeNumber : undefined,
    volumeLetters: vol && VOLUME_LETTERS.test(vol) ? vol.toUpperCase() : undefined,
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
