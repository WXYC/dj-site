import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
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
  | "call_number_required";

export type LibraryCodeSearchComposition =
  | { ready: true; args: ResolveArtistByCodeQuery }
  | { ready: false; reason: LibraryCodeCompositionRefusal; message: string };

/**
 * Composes `artistSearchForm`'s fields into `resolveArtistByCode`'s query
 * args, once `chooserValidation.validateArtistSearchForm` has already passed
 * -- this is a second, independent gate, not a restatement of that one.
 *
 * `by-code` requires a fully specified `(genre_id, code_letters,
 * code_number)` triple; the JSP's own client-side validator
 * (`library-code-form.js`) never required a call number at all, because the
 * legacy servlet fell through to a genre+letters-only browse
 * (`LibraryCodeServlet` -> `multipleArtistsDisplay.jsp`) when one was
 * missing. That browse has no Backend-Service equivalent -- there is no
 * "any number" query -- so a blank or unparseable call number is refused
 * here instead of being silently treated as a miss or forwarded as an
 * invalid request.
 */
export function composeLibraryCodeSearchArgs(
  values: LibraryCodeSearchValues,
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
    const codeNumber = parseRequiredNonNegativeInt(values.artistNumbersTextbox);
    if (codeNumber === null) {
      // Reachable from the textbox radio only: the compilation branch returns
      // above with a composed VARIOUS_ARTISTS_CODE_NUMBER and never reads the
      // call-number field at all. A reported failure that turns on this
      // refusal therefore also fixes which radio the librarian was on, and one
      // that turns out to have come from the compilation radio cannot be this.
      return {
        ready: false,
        reason: "call_number_required",
        message: "You must enter a call number to look up this code.",
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

export type ResolveArtistByCodeErrorReason = "genre_not_found" | "code_not_assigned";

type WrappedResolveArtistByCodeError = { resolveArtistByCodeError: FetchBaseQueryError };

function isWrappedResolveArtistByCodeError(
  err: unknown,
): err is WrappedResolveArtistByCodeError {
  return !!err && typeof err === "object" && "resolveArtistByCodeError" in err;
}

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
  if (!isWrappedResolveArtistByCodeError(err)) return undefined;
  const inner = err.resolveArtistByCodeError;
  if (inner.status !== 404) return undefined;
  const data = inner.data;
  if (!data || typeof data !== "object") return undefined;
  const reason = (data as { reason?: unknown }).reason;
  return reason === "genre_not_found" || reason === "code_not_assigned" ? reason : undefined;
}
