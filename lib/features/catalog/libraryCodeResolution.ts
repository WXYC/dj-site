import { bodyReason, unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import {
  CALL_LETTER_MODE_REQUIRED_MESSAGE,
  GENRE_REQUIRED_MESSAGE,
  type CallLetterMode,
} from "./chooserValidation";
import {
  CODE_LETTERS_MAX_LENGTH,
  codeLettersTooLong,
  isCanonicalCodeLetters,
  normalizeCodeLetters,
  parseRequiredNonNegativeInt,
} from "./adminCreateArtistValidation";
import {
  VARIOUS_ARTISTS_CODE_LETTERS,
  VARIOUS_ARTISTS_CODE_NUMBER,
} from "./libraryCode";
import type { ResolveArtistByCodeQuery } from "./types";

export type LibraryCodeSearchValues = {
  callLetterMode: CallLetterMode;
  artistLettersTextbox: string;
  artistNumbersTextbox: string;
  genreId: number | null;
};

/**
 * Which rule refused a composition, as a stable token rather than the message
 * shown for it. The message is UI copy and is reworded freely; this is what a
 * reported failure has to be reconstructed against, so the two are separate
 * values and the token never carries wording.
 */
export type LibraryCodeCompositionRefusal =
  | "genre_required"
  | "call_letter_mode_required"
  | "call_letters_too_long"
  | "call_letters_charset"
  | "call_number_required"
  | "call_number_malformed";

export type LibraryCodeSearchComposition =
  | { ready: true; args: ResolveArtistByCodeQuery }
  | { ready: false; reason: LibraryCodeCompositionRefusal; message: string };

/**
 * Composes `artistSearchForm`'s fields into `resolveArtistByCode`'s query
 * args, once `chooserValidation.validateArtistSearchForm` has already passed
 * -- this is a second, independent gate, not a restatement of that one.
 *
 * `by-code` answers at two specificities, and the call-number field is what
 * picks between them. A parsed number composes the fully specified
 * `(genre_id, code_letters, code_number)` triple; a BLANK one composes the
 * genre + call-letters browse, matching the JSP's own client-side validator
 * (`library-code-form.js`), which never required a call number because the
 * legacy servlet fell through to exactly that browse
 * (`LibraryCodeServlet` -> `multipleArtistsDisplay.jsp`).
 *
 * Blank and malformed are therefore not the same answer, which is the trap in
 * this function: `parseRequiredNonNegativeInt` returns `null` for both, so
 * reading its result alone would browse on a typo -- silently answering a
 * question about the whole shelf section when the librarian asked about one
 * number. The blank test runs on the raw field, before the parse.
 *
 * `allowBucketBrowse` is opt-in, and defaults to refusing, because this gate
 * is shared by two screens that do opposite things with an ambiguous answer.
 * The chooser LOOKS UP a code and has a list screen to show a whole bucket
 * on. The move screen picks a destination to WRITE a release to, and a browse
 * there would turn a blank field into a selectable list of every artist in the
 * section -- a shelf-wide menu of places to move something, offered because a
 * field was left empty. Defaulting to the browse would hand that to any future
 * caller silently; requiring the opt-in makes a screen say it has somewhere to
 * put the answer.
 */
export function composeLibraryCodeSearchArgs(
  values: LibraryCodeSearchValues,
  { allowBucketBrowse = false }: { allowBucketBrowse?: boolean } = {},
): LibraryCodeSearchComposition {
  if (values.genreId === null) {
    return { ready: false, reason: "genre_required", message: GENRE_REQUIRED_MESSAGE };
  }

  if (values.callLetterMode === "compilation") {
    // The compilation radio can only ever search the one pair, so the
    // sub-bucket letter is left to `rockCompLetters`' JSP-parity validation
    // alone -- nothing here can narrow the search by it.
    return {
      ready: true,
      args: {
        genre_id: values.genreId,
        code_letters: VARIOUS_ARTISTS_CODE_LETTERS,
        code_number: VARIOUS_ARTISTS_CODE_NUMBER,
      },
    };
  }

  if (values.callLetterMode === "textbox") {
    const codeLetters = normalizeCodeLetters(values.artistLettersTextbox.trim());
    // Length before charset, and reported separately. `isCanonicalCodeLetters`
    // is one boolean over a `{1,4}` charset regex, so letting it answer both
    // questions reports "ABCDE" — five characters, every one of them legal —
    // as "must be letters, digits, or a slash". The librarian reads a sentence
    // that describes none of what they typed, retypes the same five characters,
    // and is refused again with the actual ceiling never stated. A refusal has
    // to be actionable, not merely visible, and `reason` is also what any
    // telemetry or future branch buckets on.
    if (codeLettersTooLong(codeLetters)) {
      return {
        ready: false,
        reason: "call_letters_too_long",
        message: `Call letters must be at most ${CODE_LETTERS_MAX_LENGTH} characters.`,
      };
    }
    if (!isCanonicalCodeLetters(codeLetters)) {
      return {
        ready: false,
        reason: "call_letters_charset",
        message: "Call letters must be letters, digits, or a slash.",
      };
    }
    // Both the browse and the refusal below are reachable from the textbox
    // radio only: the compilation branch returns above with a composed
    // VARIOUS_ARTISTS_CODE_NUMBER and never reads the call-number field at
    // all. A reported outcome that turns on either therefore also fixes which
    // radio the librarian was on, and one that came from the compilation
    // radio can be neither.
    const rawCodeNumber = values.artistNumbersTextbox.trim();
    if (rawCodeNumber === "") {
      if (!allowBucketBrowse) {
        return {
          ready: false,
          reason: "call_number_required",
          message: "You must enter a call number to look up this code.",
        };
      }
      // `code_number` is OMITTED, not emptied: the endpoint 400s a
      // present-but-empty one on purpose, since `Number('')` is 0 and 0 is a
      // real V/A filing. See `ResolveArtistByCodeQuery`.
      return {
        ready: true,
        args: { genre_id: values.genreId, code_letters: codeLetters },
      };
    }
    const codeNumber = parseRequiredNonNegativeInt(rawCodeNumber);
    if (codeNumber === null) {
      // Malformed only -- blank was answered above, either way. The hint is
      // conditional because it would be a lie on a screen that refuses a blank
      // field: a librarian told to leave it blank, who then is, has been sent
      // in a circle.
      return {
        ready: false,
        reason: "call_number_malformed",
        message: allowBucketBrowse
          ? "Call numbers must be a whole number. Leave it blank to list every artist under these call letters."
          : "Call numbers must be a whole number.",
      };
    }
    return {
      ready: true,
      args: {
        genre_id: values.genreId,
        code_letters: codeLetters,
        code_number: codeNumber,
      },
    };
  }

  // Unreachable through the form's own submit handler --
  // validateArtistSearchForm already rejects a null mode before this runs.
  // Kept as an explicit, correctly-worded refusal rather than falling
  // through, so a future caller that skips that gate fails safely instead of
  // composing a bogus query.
  return {
    ready: false,
    reason: "call_letter_mode_required",
    message: CALL_LETTER_MODE_REQUIRED_MESSAGE,
  };
}

/**
 * Every answer a code lookup cannot act on reads the same, deliberately: an
 * outage, a malformed body, and a 400 differ in cause but not in what the
 * librarian can do about them. Crucially none of them means the code is free
 * — reporting an outage as "not assigned" is what files a duplicate on the
 * chooser and what moves a release onto an occupied code on the move screen.
 *
 * One constant rather than one per screen: the condition is identical, and two
 * screens wording it differently is a difference the librarian has to resolve
 * for no reason. "the lookup" names the action on both — the chooser's Search
 * and the move screen's Look up are the same request.
 */
export const UNTRUSTWORTHY_CODE_ANSWER_MESSAGE =
  "Couldn't check that library code right now. Try the lookup again.";

/**
 * `code_not_assigned` is reachable from the fully-specified arm only. A browse
 * names no single code to be unassigned, so an empty bucket under a known
 * genre is a `200` with an empty list instead -- the outcome a librarian
 * checking unused call letters gets, and a normal one. `genre_not_found`
 * stays a 404 on both arms, which is what keeps an outage from ever reading
 * as an empty bucket.
 */
export type ResolveArtistByCodeErrorReason = "genre_not_found" | "code_not_assigned";

/**
 * The `reason` a structured 404 from `resolveArtistByCode` carries, or
 * `undefined` for every other failure shape -- a 400, a 5xx, a non-JSON
 * body, a network failure. `undefined` is the caller's one fallback branch:
 * an outage this screen must refuse to act on, never read as an unassigned
 * code (see the endpoint's `extraOptions` comment in `api.ts` for the
 * consequence of getting that backwards).
 */
export function resolveArtistByCodeErrorReason(
  err: unknown,
): ResolveArtistByCodeErrorReason | undefined {
  const inner = unwrapEndpointError("resolveArtistByCodeError", err);
  if (!inner || inner.status !== 404) return undefined;
  const reason = bodyReason(inner.data);
  return reason === "genre_not_found" || reason === "code_not_assigned" ? reason : undefined;
}
