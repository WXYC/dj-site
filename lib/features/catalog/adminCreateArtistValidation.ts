import type { AddArtistConflict } from "./types";

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

export type NewArtistFieldValues = {
  alphabeticalName: string;
  codeLetters: string;
  codeNumberRaw: string;
};

export type NewArtistFieldValidation = {
  trimmedAlphabeticalName: string;
  trimmedCodeLetters: string;
  alphabeticalNameTooLong: boolean;
  codeLettersTooLong: boolean;
  /** Parsed as a positive whole number, before any range check — null if it is not one. */
  parsedCodeNumber: number | null;
  /** Parsed *and* within the column's range, or null. */
  codeNumber: number | null;
  codeNumberInvalid: boolean;
};

/**
 * Derives everything both the new-artist fields and their form's submit gate
 * need to know. Pure, so a caller computing it for `canSubmit` and the field
 * group computing it for display are reading one rule rather than keeping two
 * in step.
 */
export function validateNewArtistFields(
  values: NewArtistFieldValues,
): NewArtistFieldValidation {
  const trimmedAlphabeticalName = values.alphabeticalName.trim();
  const trimmedCodeLetters = values.codeLetters.trim();
  const parsedCodeNumber = parseRequiredPositiveInt(values.codeNumberRaw);
  // parseRequiredPositiveInt only rejects non-integers; the column's range is
  // this rule's to enforce.
  const codeNumber =
    parsedCodeNumber !== null && parsedCodeNumber <= CODE_NUMBER_MAX
      ? parsedCodeNumber
      : null;

  return {
    trimmedAlphabeticalName,
    trimmedCodeLetters,
    alphabeticalNameTooLong:
      trimmedAlphabeticalName.length > ARTIST_NAME_MAX_LENGTH,
    codeLettersTooLong: trimmedCodeLetters.length > CODE_LETTERS_MAX_LENGTH,
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
