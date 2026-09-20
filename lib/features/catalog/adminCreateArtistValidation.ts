import type { AddAlbumRequestBody, AddArtistConflict } from "./types";

/**
 * The floor `resolveArtistByCode` enforces on `code_number`. 0 is not a
 * placeholder there: it is the Various Artists filing (every compilation
 * bucket is stored at `artist_genre_code = 0`), and Backend-Service imposes
 * no floor above 0 for an ordinary artist code either, so a carried or typed
 * "0" must parse rather than be read as absent.
 *
 * Empty or non-numeric strings must not become 0 (`Number("") === 0`), and
 * only base-10 integers count — `Number` accepts scientific and hex notation
 * (`Number("1e3") === 1000`) for values no call-number field means.
 */
export function parseRequiredNonNegativeInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || !/^(?:0|[1-9]\d*)$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * The same contract with a floor of 1. Expressed in terms of the function
 * above rather than beside it: the two differ on exactly one input, and every
 * other rule they must agree on is worth stating once.
 */
export function parseRequiredPositiveInt(raw: string): number | null {
  const parsed = parseRequiredNonNegativeInt(raw);
  return parsed === 0 ? null : parsed;
}

/**
 * Characters, not UTF-16 units, after NFC normalization. Every `varchar(n)`
 * ceiling in this module is a character limit, and Backend measures them the
 * same way (its own `codePointLength`, called on `value.normalize('NFC')`) --
 * an astral character (a surrogate pair in JS, one character to PostgreSQL)
 * must cost one slot rather than two, exactly like `String#length` would get
 * wrong in the other direction.
 *
 * Normalizing here is a deliberate decision, not a side effect: this function
 * backs every ceiling in the module (`artistNameTooLong`, `codeLettersTooLong`,
 * `releaseVolumeLettersTooLong`), so all three move together rather than one
 * of them quietly disagreeing with its neighbours the way `artist_name` used
 * to disagree with the server. NFC is not length-non-increasing -- a
 * composition-exclusion codepoint (e.g. U+0958, DEVANAGARI LETTER QA) fully
 * decomposes and is then barred from recomposing, so it counts as two code
 * points here despite being one before normalization. A name that previously
 * passed a client check built on the old, non-normalizing count and was
 * refused server-side is now refused here too, visibly and before submit --
 * that is the fix, not a regression.
 */
function codePointLength(value: string): number {
  return Array.from(value.normalize("NFC")).length;
}

/**
 * Column ceilings on the rows an artist-creation form writes. Nothing between
 * these fields and the INSERT checks any of them — the handler validates only
 * that the keys are present — so an over-long or over-large value reaches
 * PostgreSQL and comes back as a 22001/22003 500 rather than a validation
 * error. Each ceiling has to hold in the form, and be visible to the MD rather
 * than failing at the far end of a submit.
 *
 * `artists.code_letters` is a `varchar(4)`; `artists.artist_name` and
 * `artists.alphabetical_name` are `varchar(128)`; the code number is filed as
 * `genre_artist_crossreference.artist_genre_code`, a PostgreSQL `integer`
 * whose range check fires at bind time, before the insert.
 */
export const CODE_LETTERS_MAX_LENGTH = 4;
export const ARTIST_NAME_MAX_LENGTH = 128;
export const CODE_NUMBER_MAX = 2147483647;

/**
 * Whether an `artist_name` or `alphabetical_name` value exceeds the
 * varchar(128) ceiling both columns share on `artists`, counted in code
 * points -- like `releaseVolumeLettersTooLong` below and Backend's own
 * `codePointLength` check, so a surrogate pair does not cost two of the 128
 * slots here and then get accepted server-side anyway. Trims first, matching
 * what every caller sends as the field's value.
 */
export function artistNameTooLong(value: string): boolean {
  return codePointLength(value.trim()) > ARTIST_NAME_MAX_LENGTH;
}

/**
 * Whether a `code_letters` value exceeds the `varchar(4)` ceiling
 * `artists.code_letters` holds, counted in code points after NFC
 * normalization -- matching Backend's own `validateArtistCodeLetters`, so a
 * decomposed form of the same code is measured the same as its composed one
 * and neither passes here only to be refused server-side. Trims first,
 * matching what every caller sends as the field's value. The one exported
 * check for this column: `validateNewArtistFields` below calls it rather than
 * repeating the count, and so does every classic-experience form that collects
 * call letters outside that helper's shape.
 */
export function codeLettersTooLong(value: string): boolean {
  return codePointLength(value.trim()) > CODE_LETTERS_MAX_LENGTH;
}

/**
 * The floor/ceiling `POST /library` enforces on `code_number` -- the
 * release's own column, `library.code_number`, a `smallint`. Distinct from
 * `CODE_NUMBER_MAX` above, which bounds the artist-creation column
 * (`genre_artist_crossreference.artist_genre_code`, an `integer`): the two
 * forms write different columns with different ranges, so sharing one
 * constant between them would either falsely narrow artist creation or
 * falsely widen release filing.
 */
export const RELEASE_CODE_NUMBER_MAX = 32767;

/**
 * The ceiling `POST /library` enforces on `library.code_volume_letters`, a
 * `varchar(4)`. The same 4 as `CODE_LETTERS_MAX_LENGTH` today, and a separate
 * constant anyway, for the reason stated just above: these are different
 * columns on different tables, and Backend validates them against two
 * independent constants of its own (`MAX_CODE_VOLUME_LETTERS_LENGTH` for this
 * one, `MAX_ARTIST_CODE_LETTERS_LENGTH` for the artist's). Sharing one name
 * here would mean widening `artists.code_letters` silently widens release
 * filing past a ceiling Backend still enforces -- turning this form's inline
 * refusal back into an unattributed 400, with the constant that moved not
 * named for the column that broke.
 */
export const RELEASE_VOLUME_LETTERS_MAX_LENGTH = 4;

/**
 * One wording for "that is not a call number this column can hold", shared by
 * every release-filing form. Same reasoning as
 * `RELEASE_VOLUME_LETTERS_TOO_LONG_MESSAGE` below: the artist card, the
 * compilation bucket's card, and the rotation-import screen write the same
 * column, and a librarian who reads one sentence on one screen and a different
 * one on another reads them as two different problems. It names the field
 * because the pair of inputs is labelled as one "Library Code" on both cards,
 * and on the import screen too whenever it knows the artist half -- the refusal
 * has to say which half of that code it is about. The ceiling is interpolated
 * so the sentence cannot drift from `RELEASE_CODE_NUMBER_MAX`.
 */
export const RELEASE_CODE_NUMBER_OUT_OF_RANGE_MESSAGE = `The release call number must be a whole number between 1 and ${RELEASE_CODE_NUMBER_MAX}.`;

/**
 * Parses an operator-typed `code_number` for an add-release form: base-10
 * digits with no leading zeros, floor 1, ceiling `RELEASE_CODE_NUMBER_MAX`.
 * Everything else is null.
 *
 * Empty is *not* distinguished from invalid, and a caller must not read one as
 * the other. "An empty field means let the server assign" is a caller's rule,
 * because only the caller knows whether its field can be empty at all: both
 * add-release cards can leave the field empty and omit the `code_number` key
 * entirely, which `resolveReleaseCodeFields` below decides once for the pair of
 * them, while `RotationImportScreen`'s field always has a value to parse (it
 * falls back to the peeked `defaultCodeNumber`) and so reports a cleared field
 * as its own refusal.
 *
 * Shared rather than copied, and all four live release-filing surfaces reach
 * it: `ArtistCard`'s and `VariousArtistsCard`'s add-release forms through
 * `resolveReleaseCodeFields`, `RotationImportScreen`'s `validateRelease`
 * directly -- which gates that screen's existing-artist and new-artist submits
 * alike -- and `ReleaseCard`'s editor, the one caller editing a number that
 * already exists. That last one parses only a field the librarian actually
 * changed, so a cleared or out-of-range entry is refused while a stored value
 * this function would itself reject -- a legacy 0 -- leaves the rest of that
 * screen saveable instead of locking it. There is no fifth copy -- the local
 * `parsePositiveInt` the import screen used to parse this column with is gone,
 * so all four surfaces agree on what a call number is instead of drifting.
 */
export function parseReleaseCodeNumber(raw: string): number | null {
  const parsed = parseRequiredPositiveInt(raw);
  return parsed !== null && parsed <= RELEASE_CODE_NUMBER_MAX ? parsed : null;
}

/**
 * Length check for `code_volume_letters`: like `code_letters`, this column is
 * gated on length alone at the point of filing. `isCanonicalCodeLetters`
 * below is not a filing rule at all -- it answers what `GET
 * /library/artists/by-code` can *look up*, and nothing on this form or the
 * artist-creation form applies it to what gets stored. Bounded by
 * `RELEASE_VOLUME_LETTERS_MAX_LENGTH`, this column's own ceiling, and counted
 * in code points, matching how Backend measures it
 * (`validateCodeVolumeLetters` counts code points, not UTF-16 units) so a
 * surrogate pair does not cost two of the four slots here and then get stored
 * server-side anyway. Inherits NFC normalization from `codePointLength`
 * rather than opting out of it: this column shares the shared helper with
 * `artistNameTooLong` and `codeLettersTooLong` deliberately, so all three
 * volume-letters/call-letters/name ceilings agree with the server on the same
 * input instead of one of them quietly measuring a decomposed form longer
 * than its composed equivalent.
 *
 * A second, unreconciled declaration of this column's domain exists:
 * `lib/features/rotation/importedConfirmation.ts`'s
 * `VOLUME_LETTERS = /^[A-Za-z]{1,4}$/`, commented "letters are all it
 * holds." That regex *drops* a non-matching value rather than rendering it,
 * where this function's callers store whatever was typed. So all three forms
 * will happily file "1", "-", "A B", "??", "A/B", or a single emoji into
 * `code_volume_letters`, and that value is then omitted from the one sentence
 * that tells a librarian where the record went.
 *
 * The path that reaches that sentence is the rotation-import round trip, not
 * the artist card: `RotationImportScreen` pushes the server-echoed value into
 * `&vol=`, `parseImportedReleaseParams` reads it back, and
 * `importedConfirmation` drops anything the regex refuses -- so a row filed at
 * `MO 12/7-a/b` lands on the card reading "Filed as Rock MO 12/7". The artist
 * card's own post-save code cannot show this: it is composed by
 * `formatEntireLibraryCode` from what `POST /library` echoed, which renders
 * whatever was stored.
 *
 * Which half is actually the column's intended domain -- anything
 * length-limited, or letters only -- is not decided here; it is an open
 * product question, not something this function's length check should be read
 * as having settled.
 *
 * Wired into all four volume-letters inputs this repo ships: `ArtistCard`'s
 * and `VariousArtistsCard`'s add-release forms through
 * `resolveReleaseCodeFields` below, `RotationImportReleaseFields.tsx`'s
 * "Volume Letters" field through `RotationImportScreen.tsx`'s
 * `validateRelease` -- which gates both of that screen's submit paths, so one
 * check covers the existing-artist and new-artist imports alike -- and
 * `ReleaseCard`'s editor. The import screen is where an unchecked value costs
 * the most: it reaches Backend as a plain 400 with no field attribution, on a
 * multi-step screen where a failed submit is expensive to recover from.
 */
export function releaseVolumeLettersTooLong(raw: string): boolean {
  return codePointLength(raw.trim()) > RELEASE_VOLUME_LETTERS_MAX_LENGTH;
}

/**
 * One wording for the refusal, shared by all three volume-letters inputs
 * above. Same reasoning as
 * `lib/features/rotation/releaseFormValidation.ts`'s message constants: a
 * librarian who reads one sentence for a condition on one filing screen and a
 * different one for the same condition on another reads them as two different
 * problems. The ceiling is interpolated rather than spelled out so the sentence
 * cannot drift from `RELEASE_VOLUME_LETTERS_MAX_LENGTH`.
 */
export const RELEASE_VOLUME_LETTERS_TOO_LONG_MESSAGE = `The release volume letters must be at most ${RELEASE_VOLUME_LETTERS_MAX_LENGTH} characters.`;

/**
 * What an add-release form's two call-code fields resolve to: either the
 * refusal to show the librarian, or the `POST /library` body keys to send.
 * `refusal === null` is the accepted case and the only one carrying
 * `bodyFields`, so a caller cannot read the keys without having handled the
 * refusal first.
 */
export type ReleaseCodeFields =
  | { refusal: string }
  | {
      refusal: null;
      /**
       * Spread into the request body. A key is *absent* rather than null or ""
       * where the librarian left its field empty -- omission is how the form
       * asks the server to decide, and the server's two decisions differ:
       * `MAX(code_number) + 1` for the call number, NULL for the letters.
       */
      bodyFields: Pick<AddAlbumRequestBody, "code_number" | "code_volume_letters">;
    };

/**
 * Resolves both halves of an operator-typed release call code for a form whose
 * call-number field may be left empty.
 *
 * One function rather than one block per form, because four decisions have to
 * hold together and a form that drifts on any of them files a release at a call
 * code the librarian never read off the screen: that an empty field requests the
 * server's own value instead of being refused, that the call-number refusal is
 * reported ahead of the volume-letters one when both fields are bad, that what
 * is stored is the trimmed value, and that an empty field omits its key. Nothing
 * on the write path refuses a release filed into an occupied shelf slot, so a
 * form that disagrees with its sibling on any of the four is found later by
 * `jobs/library-call-number-dedup` rather than at the point of filing.
 *
 * Both classic add-release cards call this -- the ordinary artist card's form
 * and the compilation bucket's. `RotationImportScreen` deliberately does not:
 * its call-number field is never empty (untouched, it shows a peeked default),
 * so a cleared field there is its own refusal rather than a request for the
 * server's assignment, and the assign-on-blank rule this encodes does not apply.
 */
export function resolveReleaseCodeFields(
  codeNumberRaw: string,
  volumeLettersRaw: string,
): ReleaseCodeFields {
  const trimmedCodeNumber = codeNumberRaw.trim();
  let codeNumber: number | undefined;
  if (trimmedCodeNumber !== "") {
    const parsed = parseReleaseCodeNumber(trimmedCodeNumber);
    if (parsed === null) {
      return { refusal: RELEASE_CODE_NUMBER_OUT_OF_RANGE_MESSAGE };
    }
    codeNumber = parsed;
  }

  const trimmedVolumeLetters = volumeLettersRaw.trim();
  if (releaseVolumeLettersTooLong(trimmedVolumeLetters)) {
    return { refusal: RELEASE_VOLUME_LETTERS_TOO_LONG_MESSAGE };
  }

  const bodyFields: Pick<
    AddAlbumRequestBody,
    "code_number" | "code_volume_letters"
  > = {
    ...(codeNumber != null ? { code_number: codeNumber } : {}),
    ...(trimmedVolumeLetters !== ""
      ? { code_volume_letters: trimmedVolumeLetters }
      : {}),
  };
  return { refusal: null, bodyFields };
}

/**
 * Call letters are matched case-sensitively everywhere the backend uses them —
 * the duplicate pre-check and the next-code-number scan both compare the
 * column for equality, over a plain btree on a non-citext column — and the
 * existing card catalog is filed uppercase. Lowercase "mo" therefore matches
 * no row of the "MO" series: it slips past the duplicate check and previews a
 * next code of 1, opening a second series that shadows the real one while the
 * form reports success. Normalizing at the edge keeps the field, the code
 * preview, and the request body on the one casing the catalog actually uses.
 *
 * Case is the only thing normalized. The catalog files live codes that are not
 * plain letters — "V/A" for Various Artists compilations, "??" placeholders,
 * and codes carrying digits — so narrowing this field to A-Z would make those
 * releases impossible to file. The permissiveness is load-bearing.
 *
 * Also used for `code_volume_letters`, on all four release-filing surfaces --
 * the artist card's, the compilation bucket card's, the rotation-import
 * screen's, and the release editor's call-letter input -- for the same reason
 * under a different column. Every reader of that column already folds case:
 * `formatReleaseCode` uppercases it for display, Backend's shelf-slot dedup
 * keys on `upper(coalesce(code_volume_letters, ''))`, and
 * `parseImportedReleaseParams` uppercases it too. So a stored "b" is not
 * visible beside a stored "B" -- both render `-B`, which is precisely the
 * problem: they are two rows in one shelf slot that look identical to the
 * librarian who created them, and `jobs/library-call-number-dedup` finds them
 * later as merge candidates. The input's own raw value is the only place the
 * two spellings differ at all, which is why normalizing at the edge is the
 * cheap fix: what is written and what every reader compares end up on one
 * casing.
 *
 * One consequence is load-bearing and easy to miss:
 * `library.code_volume_letters LIKE 'Z%'` is the Various Artists/compilation
 * auto-detect signal, and it is matched CASE-SENSITIVELY -- by LML
 * (`@wxyc/shared`'s `BulkResolveLibrariesRequest` documents both signals it
 * detects on) and by Backend's own `jobs/library-identity-consumer`
 * (`VA_COHORT_CONDITION`). So uppercasing a typed "z" enrols the release in
 * the V/A cohort. That is the coherent outcome rather than an accident: the
 * shelf slot keys on `upper(...)` either way, so leaving the "z" lowercase
 * would file the row in the `Z` dedup slot while excluding it from the cohort
 * that slot implies -- split two ways instead of one. Uppercasing makes the
 * slot and the cohort agree. The corollary for a librarian: "Z" is not a free
 * shelf letter, and an ordinary single-artist release must not be filed under
 * it.
 */
export function normalizeCodeLetters(value: string): string {
  return value.toUpperCase();
}

/**
 * Whether a code can be *looked up* by `GET /library/artists/by-code`, which
 * rejects anything else with a 400.
 *
 * Deliberately narrower than what `normalizeCodeLetters` above lets a
 * librarian file, and the gap is real rather than an oversight: the catalog
 * holds `??` placeholders and legacy `Z-<letter>` compilation codes, and
 * neither is resolvable by code. Answering the narrow question here, beside
 * the column's other rules, is what keeps a caller from re-deriving the
 * domain — and from mistaking this for what may be stored.
 */
const CANONICAL_CODE_LETTERS = new RegExp(`^[A-Za-z0-9/]{1,${CODE_LETTERS_MAX_LENGTH}}$`);

export function isCanonicalCodeLetters(value: string): boolean {
  return CANONICAL_CODE_LETTERS.test(value);
}

/**
 * A starting suggestion for a new artist's call letters: the first two
 * letters of the name, diacritics folded and a leading "The " skipped, the
 * way the catalog's two-letter convention files them ("Nilüfer Yanya" → "NI",
 * "The Clean" → "CL"). Empty when the name has no A–Z letters at all —
 * punctuation-only names take a hand-chosen code, and seeding "" leaves the
 * field's own placeholder showing. A seed, never an owner: the field stays
 * fully editable, and nothing re-derives this after the MD touches it.
 */
export function suggestCodeLetters(name: string): string {
  const folded = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^THE\s+/, "");
  return (folded.match(/[A-Z]/g) ?? []).slice(0, 2).join("");
}

export type NewArtistFieldValues = {
  alphabeticalName: string;
  codeLetters: string;
  codeNumberRaw: string;
};

export type NewArtistFieldValidation = {
  trimmedAlphabeticalName: string;
  trimmedCodeLetters: string;
  alphabeticalNameTooLong: boolean;
  /** Delegates to `codeLettersTooLong` above -- see that function's doc for what it measures and why. */
  codeLettersTooLong: boolean;
  /** Parsed as a whole number the mode accepts, before any range check — null if it is not one. */
  parsedCodeNumber: number | null;
  /** Parsed *and* within the column's range, or null. */
  codeNumber: number | null;
  codeNumberInvalid: boolean;
};

export type ValidateNewArtistFieldsOptions = {
  /**
   * Whether a deliberate 0 is a legal code number. The compilation bucket
   * lives at artist_genre_code = 0 and Backend-Service imposes no floor above
   * it, so the filing bench (which files compilations) accepts 0. Off by
   * default: the artist-add form stays positive-only, so a stray 0 there is
   * caught rather than filed into the compilation bucket.
   */
  allowZeroCodeNumber?: boolean;
};

/**
 * Derives everything both the new-artist fields and their form's submit gate
 * need to know. Pure, so a caller computing it for `canSubmit` and the field
 * group computing it for display are reading one rule rather than keeping two
 * in step.
 */
export function validateNewArtistFields(
  values: NewArtistFieldValues,
  { allowZeroCodeNumber = false }: ValidateNewArtistFieldsOptions = {},
): NewArtistFieldValidation {
  const trimmedAlphabeticalName = values.alphabeticalName.trim();
  const trimmedCodeLetters = values.codeLetters.trim();
  // Positive-only by default; the bench opts into accepting 0 for the
  // compilation bucket. Only the column's int4 range is this rule's other
  // concern.
  const parsedCodeNumber = allowZeroCodeNumber
    ? parseRequiredNonNegativeInt(values.codeNumberRaw)
    : parseRequiredPositiveInt(values.codeNumberRaw);
  const codeNumber =
    parsedCodeNumber !== null && parsedCodeNumber <= CODE_NUMBER_MAX
      ? parsedCodeNumber
      : null;

  return {
    trimmedAlphabeticalName,
    trimmedCodeLetters,
    // `artists.alphabetical_name` shares its varchar(128) ceiling with
    // `artist_name`, so this reuses `artistNameTooLong` rather than a second
    // UTF-16 `.length` check that would disagree with it on the same column.
    alphabeticalNameTooLong: artistNameTooLong(trimmedAlphabeticalName),
    codeLettersTooLong: codeLettersTooLong(trimmedCodeLetters),
    parsedCodeNumber,
    codeNumber,
    codeNumberInvalid:
      values.codeNumberRaw.trim().length > 0 && codeNumber === null,
  };
}

/**
 * True when a `POST /library/artists` submission was refused as conflicting,
 * whatever the reason. Resubmitting the same triple unchanged can only be
 * refused the same way, so this — not the body's shape — is what a caller
 * gates resubmission on.
 *
 * Deliberately blind to the body: the backend answers 409 for more than one
 * reason (the code-triple conflict, the genre-scoped artist-name conflict),
 * an intermediary can answer 409 with JSON of its own, and a body that fails
 * to parse narrows what can be *said* about the refusal, never whether one
 * happened.
 */
export function isConflictRejection(
  err: unknown,
): err is { status: 409; data: unknown } {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  return (err as { status?: unknown }).status === 409;
}

/**
 * True when a `POST /library/artists` rejection is a 409 that names an
 * artist the request conflicts with — the shape both the code-triple
 * conflict and the genre-scoped artist-name conflict share, so a caller can
 * report by name instead of as a generic failure. Which of the two it is is
 * a separate question, answered by `isArtistNameConflictData` against the
 * same body.
 *
 * Two places have to agree on this exact test, which is why it is one function
 * rather than two: the endpoint drops the body's generic `message` so the
 * recoverable outcome is reported once rather than as a banner plus a toast,
 * and the caller dereferences `artist.artist_name` while rendering that banner
 * with no error boundary beneath it. Were the strip the broader test, a 409
 * reason this form cannot name an artist from — or an intermediary answering
 * 409 with its own JSON — would lose its message before anything could
 * surface it, leaving only a generic fallback. Were the banner's the broader
 * one, it would throw on a body that carries no artist.
 */
export function isAddArtistConflict(
  err: unknown,
): err is { status: 409; data: AddArtistConflict } {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  const { status, data } = err as { status?: unknown; data?: unknown };
  if (status !== 409 || !data || typeof data !== "object") return false;
  const { artist } = data as { artist?: unknown };
  return (
    !!artist &&
    typeof artist === "object" &&
    typeof (artist as { artist_name?: unknown }).artist_name === "string"
  );
}

/**
 * True when a `POST /library/artists` 409 body identifies itself as the
 * genre-scoped artist-name conflict rather than the pre-existing code-triple
 * conflict. The discriminant is `reason === "artist_name_conflict"` on the
 * raw body; every other value — including a body with no `reason` field at
 * all, which is exactly what today's deployed backend sends on its one 409 —
 * is the code-triple case. Takes the raw, untyped body rather than routing
 * through `isAddArtistConflict` so the distinction stays correct even against
 * a body this form cannot otherwise name an artist from.
 */
export function isArtistNameConflictData(
  data: unknown,
): data is { reason: "artist_name_conflict" } {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { reason?: unknown }).reason === "artist_name_conflict"
  );
}
