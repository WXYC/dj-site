"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useGetGenresQuery, useLazyResolveArtistByCodeQuery } from "@/lib/features/catalog/api";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import {
  isRockCompLettersRequired,
  validateArtistSearchForm,
  type CallLetterMode,
} from "@/lib/features/catalog/chooserValidation";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import {
  composeLibraryCodeSearchArgs,
  resolveArtistByCodeErrorReason,
  UNTRUSTWORTHY_CODE_ANSWER_MESSAGE,
} from "@/lib/features/catalog/libraryCodeResolution";
import type { ArtistByCodeOwner } from "@/lib/features/catalog/types";

/** A code search that matched more than one artist -- `LibraryChooser` swaps to `MultipleArtistsDisplay` on this. */
export type MultiMatchResult = {
  genreName: string | undefined;
  codeLetters: string;
  codeNumber: number;
  artists: ArtistByCodeOwner[];
};

type ArtistSearchFormProps = {
  /**
   * Called instead of navigating when a code search matches more than one
   * artist. Required rather than optional: a caller that omits it has no
   * disambiguation screen to show, and the multi-match branch would leave
   * the librarian looking at a Search button that did nothing.
   */
  onMultiMatch: (result: MultiMatchResult) => void;
};

/**
 * Reproduces `chooseLibraryCodeOrArtist.jsp`'s `artistSearchForm`: genre
 * select, the textbox-vs-compilation call-letter mode radios, and the
 * Rock/Soundtracks-only `rockCompLetters` sub-bucket field, validated to the
 * JSP's exact client-side rules (`library-code-form.js`).
 *
 * On submit, resolves the composed code against `resolveArtistByCode`
 * (`GET /library/artists/by-code`) and goes straight to its outcome, matching
 * the JSP's own `findOrCreateLibraryCode` -- no confirmation or results screen
 * in between. A multi-match leaves through `onMultiMatch` rather than
 * rendering here, because the JSP replaces the *whole page* on one, not just
 * this form's subtree. Every answer this screen cannot trust stops it: see
 * `resolveArtistByCodeErrorReason` for why an outage must never be read as
 * "code not assigned."
 *
 * Three divergences from the JSP, each forced by a Backend contract that has
 * no legacy equivalent:
 *
 * 1. `resolveArtistByCode` requires a fully specified `(genre_id,
 *    code_letters, code_number)` triple. The JSP's own client-side validator
 *    never required a call number at all -- a blank one fell through to a
 *    genre+letters-only browse (`LibraryCodeServlet` ->
 *    `multipleArtistsDisplay.jsp`) that Backend-Service cannot answer, since
 *    there is no "any number" query. This form still accepts a blank call
 *    number past `validateArtistSearchForm` (matching the JSP rule-for-rule),
 *    then refuses at submit with a message asking for one, rather than
 *    guessing a number or reintroducing a browse the API cannot back. See
 *    `composeLibraryCodeSearchArgs`.
 * 2. A fully specified code with more than one owner reaches the
 *    disambiguation screen here. The legacy servlet's own fully-specified
 *    lookup ends in `findFirst()` over an unordered query, so it silently
 *    hands the librarian one arbitrary row out of a contested code and
 *    cannot tell one match from twenty-seven. `by-code` answers a list
 *    precisely so that guess is not forced.
 * 3. The compilation radio's misses route to the creation flow like the
 *    textbox radio's do. The servlet instead redirects a compilation miss
 *    back to an empty chooser with no message at all, contradicting this
 *    screen's own heading ("If the code does not exist, you will get the
 *    chance to create it"). The heading is reproduced verbatim, so the
 *    behavior it promises is reproduced with it.
 *
 * The compilation radio always searches the fixed `V/A`/0 pair for the
 * selected genre, never a value composed from `rockCompLetters`: see
 * `composeLibraryCodeSearchArgs`'s doc for why that field cannot narrow a
 * Backend-Service search, even though it is still collected and validated
 * for JSP parity.
 *
 * `library-code-form.js`'s textbox branch reads only `artistLettersTextbox`,
 * never `genreID`, so a submit landing inside this form's client-side genre
 * fetch passes JSP-parity validation with `genreId` still null.
 * `composeLibraryCodeSearchArgs` is where that case is caught -- not a
 * widening of the shared validator, which would make a JSP-faithful state
 * read as a JSP-parity failure.
 */
export default function ArtistSearchForm({ onMultiMatch }: ArtistSearchFormProps) {
  const router = useRouter();
  const genreFieldId = useId();
  const lettersId = useId();
  const numbersId = useId();
  const rockCompLettersId = useId();

  const genresQuery = useGetGenresQuery();
  const { data: genres, isFetching: genresFetching, refetch: refetchGenres } = genresQuery;
  // See isGenresUnavailable's doc for the cached-list trap: `isError` can be
  // true while a good cached list is still on screen, so this reads
  // absence-of-list, never the error flag.
  const genresUnavailable = isGenresUnavailable(genresQuery);
  const [resolveArtistByCode, { isFetching: isResolving }] = useLazyResolveArtistByCodeQuery();

  const [genreId, setGenreId] = useState<number | null>(null);
  const [callLetterMode, setCallLetterMode] = useState<CallLetterMode>(null);
  const [artistLettersTextbox, setArtistLettersTextbox] = useState("");
  const [artistNumbersTextbox, setArtistNumbersTextbox] = useState("");
  const [rockCompLetters, setRockCompLetters] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // The JSP's <select name="genreID"> carries no empty option, so the browser
  // selects the first <option> the moment the page loads — a genre is always
  // chosen, never absent. This form's genre list is fetched client-side, so
  // there is a real gap between mount and that data arriving; deriving the
  // effective genre as soon as it does reproduces the JSP's "always
  // selected" invariant instead of leaving a JSP-impossible unselected state
  // standing indefinitely.
  const effectiveGenreId = genreId ?? genres?.[0]?.id ?? null;

  const showRockCompLetters =
    callLetterMode === "compilation" && isRockCompLettersRequired(effectiveGenreId);

  const reset = () => {
    setCallLetterMode(null);
    setArtistLettersTextbox("");
    setArtistNumbersTextbox("");
    setRockCompLetters("");
    setValidationMessage(null);
    // A native <input type=reset> restores a <select> to its default option
    // along with the rest of the form; mirror that by clearing the
    // librarian's explicit pick so the select falls back to the derived
    // default genre above.
    setGenreId(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const result = validateArtistSearchForm({
      callLetterMode,
      artistLettersTextbox,
      rockCompLetters,
      genreId: effectiveGenreId,
    });

    if (!result.valid) {
      setValidationMessage(result.message);
      return;
    }

    setValidationMessage(null);

    const composed = composeLibraryCodeSearchArgs({
      callLetterMode,
      artistLettersTextbox,
      artistNumbersTextbox,
      genreId: effectiveGenreId,
    });

    if (!composed.ready) {
      setValidationMessage(composed.message);
      return;
    }

    // Deciding what a *successful* answer means stays outside the guard, so a
    // throw from `router.push` or `onMultiMatch` surfaces as itself rather
    // than being reported as a lookup the librarian should retry.
    let owners: ArtistByCodeOwner[];
    try {
      owners = (await resolveArtistByCode(composed.args).unwrap()).artists;
    } catch (err) {
      const reason = resolveArtistByCodeErrorReason(err);

      if (reason === "code_not_assigned") {
        const params = new URLSearchParams({
          genre_id: String(composed.args.genre_id),
          code_letters: composed.args.code_letters,
          code_number: String(composed.args.code_number),
        });
        router.push(`/dashboard/library/artist/new?${params.toString()}`);
        return;
      }

      if (reason === "genre_not_found") {
        setValidationMessage(
          `No genre in the catalog has id ${composed.args.genre_id}, so this code can't be looked up.`,
        );
        return;
      }

      // A validation failure, a 5xx, or an outage: refuse to act rather than
      // guess -- see resolveArtistByCodeErrorReason's doc.
      setValidationMessage(UNTRUSTWORTHY_CODE_ANSWER_MESSAGE);
      return;
    }

    // A 200 with no owners is a shape the endpoint's contract never produces
    // -- an unassigned code is a 404 carrying `code_not_assigned`. Reaching
    // here means the answer cannot be trusted, so it is refused like any other
    // malformed one: routing to the creation flow would file a duplicate, and
    // the disambiguation screen would assert the code exists with nobody
    // holding it.
    if (owners.length === 0) {
      setValidationMessage(UNTRUSTWORTHY_CODE_ANSWER_MESSAGE);
      return;
    }

    if (owners.length === 1) {
      router.push(artistCardHref(owners[0]));
      return;
    }

    const genreName = genres?.find((genre) => genre.id === composed.args.genre_id)?.genre_name;
    onMultiMatch({
      genreName,
      codeLetters: composed.args.code_letters,
      codeNumber: composed.args.code_number,
      artists: owners,
    });
  };

  return (
    <form name="artistSearchForm" onSubmit={handleSubmit}>
      <h3>
        Enter a library code below. If the code exists, you will be taken to the appropriate page.
        <br />
        If the code does not exist, you will get the chance to create it and associate it with an
        artist.
      </h3>

      <table cellPadding={5}>
        <tbody>
          <tr>
            <td style={{ textAlign: "right" }}>
              <label htmlFor={genreFieldId}>Genre:</label>
            </td>
            <td>
              <select
                id={genreFieldId}
                value={effectiveGenreId ?? ""}
                // No JSP-absent empty option once genres have loaded — see
                // the derivation above. Disabled (with nothing to select) is
                // this list's own pre-load state, not a stand-in for the
                // JSP's empty option.
                disabled={!genres || genres.length === 0}
                onChange={(e) => setGenreId(e.target.value ? Number(e.target.value) : null)}
              >
                {(genres ?? []).map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.genre_name}
                  </option>
                ))}
              </select>
              {genresUnavailable && (
                <div role="alert" className="artist-error-message">
                  Genres are unavailable, so a code can&apos;t be looked up right now.{" "}
                  <button
                    type="button"
                    disabled={genresFetching}
                    onClick={() => refetchGenres()}
                  >
                    Try again
                  </button>
                </div>
              )}
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "right" }}>Call Letters/Numbers:</td>
            <td>
              <input
                type="radio"
                name="callLetterMode"
                value="textbox"
                checked={callLetterMode === "textbox"}
                onChange={() => setCallLetterMode("textbox")}
                aria-label="Call letters: mode"
              />
              Call letters:
              <input
                id={lettersId}
                type="text"
                aria-label="Call letters:"
                value={artistLettersTextbox}
                disabled={callLetterMode !== "textbox"}
                onChange={(e) => setArtistLettersTextbox(e.target.value)}
                size={2}
                maxLength={2}
              />
              &nbsp;Call Numbers:
              <input
                id={numbersId}
                type="text"
                aria-label="Call Numbers:"
                value={artistNumbersTextbox}
                disabled={callLetterMode !== "textbox"}
                onChange={(e) => setArtistNumbersTextbox(e.target.value)}
                size={3}
                maxLength={3}
              />
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "right" }} />
            <td>
              <input
                type="radio"
                name="callLetterMode"
                value="compilation"
                checked={callLetterMode === "compilation"}
                onChange={() => setCallLetterMode("compilation")}
                aria-label="Various Artists (compilations)"
              />
              Various Artists (compilations)
              {showRockCompLetters && (
                <span id="span_rockVA_letters">
                  <input
                    id={rockCompLettersId}
                    type="text"
                    aria-label="Rock comp letter"
                    value={rockCompLetters}
                    onChange={(e) => setRockCompLetters(e.target.value)}
                    size={1}
                    maxLength={1}
                  />
                  (Rock comps require a Call Letter)
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "right" }} />
            <td />
          </tr>
          <tr>
            <td />
            <td>
              <div
                id="validationMessage"
                className={`validation-message${validationMessage ? " visible" : ""}`}
                role={validationMessage ? "alert" : undefined}
              >
                {validationMessage}
              </div>
            </td>
          </tr>
          <tr>
            <td />
            <td>
              {/* Disabled through a genre outage rather than left to refuse
                  on submit: with no genre list, the JSP-parity rules would
                  answer "You must select a genre", blaming the librarian for
                  a backend that is down beside a select they cannot open.
                  The banner above says the true thing once. */}
              <input type="submit" value="Search!" disabled={isResolving || genresUnavailable} />
              &nbsp;&nbsp;&nbsp;&nbsp;
              <input type="button" value="Reset values" onClick={reset} disabled={isResolving} />
            </td>
          </tr>
        </tbody>
      </table>
    </form>
  );
}
