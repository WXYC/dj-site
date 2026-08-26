import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { CallLetterMode } from "./chooserValidation";
import { parseRequiredNonNegativeInt } from "./adminCreateArtistValidation";
import type { ResolveArtistByCodeQuery } from "./types";

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
export type LibraryCodeSearchValues = {
  callLetterMode: CallLetterMode;
  artistLettersTextbox: string;
  artistNumbersTextbox: string;
  genreId: number | null;
};

export type LibraryCodeSearchComposition =
  | { ready: true; args: ResolveArtistByCodeQuery }
  | { ready: false; message: string };

/**
 * The literal code Backend-Service's catalog import files every Various
 * Artists bucket under, regardless of genre -- see `libraryCode.ts`'s header
 * for the collapse this reflects. The JSP composed a genre-specific
 * `Z-<letter>` search key from the compilation radio's `rockCompLetters`
 * sub-bucket field for Rock/Soundtracks; that letter does not survive in
 * Backend-Service's storage, so it cannot narrow this search. Every
 * compilation bucket for a genre collides on this one triple, which is the
 * disambiguation screen's actual production trigger -- `V/A`/12/0 has 27
 * owners, `V/A`/11/0 has 26, in the current catalog.
 */
const VARIOUS_ARTISTS_CODE_LETTERS = "V/A";
const VARIOUS_ARTISTS_CODE_NUMBER = 0;

export function composeLibraryCodeSearchArgs(
  values: LibraryCodeSearchValues,
): LibraryCodeSearchComposition {
  if (values.genreId === null) {
    return { ready: false, message: "You must select a genre." };
  }

  if (values.callLetterMode === "compilation") {
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
    const codeNumber = parseRequiredNonNegativeInt(values.artistNumbersTextbox);
    if (codeNumber === null) {
      return { ready: false, message: "You must enter a call number to look up this code." };
    }
    return {
      ready: true,
      args: {
        genre_id: values.genreId,
        code_letters: values.artistLettersTextbox.trim(),
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
    message: "You must select one of the choices for Call Letters/Numbers.",
  };
}

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
