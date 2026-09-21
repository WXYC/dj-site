"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useGetGenresQuery, useLazyResolveArtistByCodeQuery } from "@/lib/features/catalog/api";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import {
  isRockCompLettersRequired,
  validateArtistSearchForm,
  type ArtistSearchValidationField,
  type CallLetterMode,
} from "@/lib/features/catalog/chooserValidation";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import {
  composeLibraryCodeSearchArgs,
  resolveArtistByCodeErrorReason,
  UNTRUSTWORTHY_CODE_ANSWER_MESSAGE,
  type LibraryCodeCompositionRefusal,
} from "@/lib/features/catalog/libraryCodeResolution";
import type { ArtistByCodeOwner } from "@/lib/features/catalog/types";
import { safeCapture } from "@/lib/posthog";

/**
 * Only two of this search's nine endings move the URL, so a pageview stream
 * cannot tell the other seven apart -- or see them at all. The event carries
 * the outcome plus enough of the composed code to reproduce the search, which
 * is what a report of "it went to an error page" has to be read against.
 */
const CHOOSER_EVENTS = {
  CODE_SEARCH: "library_code_search",
} as const;

/**
 * Typed-total on purpose: the capture sites pass string literals, so a browse
 * that reused `multi_match` would compile and silently merge two populations
 * that mean different things -- "this code is contested" and "here is the
 * shelf section". The browse's endings are named apart for that reason, and
 * `browse_empty` is a success, not a failure: unused call letters are a normal
 * thing for a librarian to check.
 */
type LibraryCodeSearchOutcome =
  | "refused"
  | "not_assigned"
  | "genre_not_found"
  | "lookup_untrusted"
  | "empty_owner_list"
  | "single_owner"
  | "multi_match"
  | "browse_results"
  | "browse_empty";

/**
 * The two gates refuse for overlapping reasons under different names, so both
 * report into one vocabulary -- otherwise "the genre was missing" reads as two
 * unrelated values depending on which gate caught it. Typed-total, so a new
 * validation field has to be given a token rather than silently going
 * unreported.
 */
type CodeSearchRefusal =
  | LibraryCodeCompositionRefusal
  | "call_letters_required"
  | "rock_comp_letter_required";

const REFUSAL_BY_VALIDATION_FIELD: Record<ArtistSearchValidationField, CodeSearchRefusal> = {
  genreId: "genre_required",
  callLetterMode: "call_letter_mode_required",
  artistLettersTextbox: "call_letters_required",
  rockCompLetters: "rock_comp_letter_required",
};

/**
 * A search that ends on `MultipleArtistsDisplay` rather than on an artist
 * card -- `LibraryChooser` swaps screens on this. Two searches reach it: a
 * fully specified code with more than one owner, and a call-letters browse at
 * any size, including none.
 *
 * `codeNumber` is the HEADER's number and is `null` for a browse, which has no
 * single number to name. It is deliberately not the rows' number: those travel
 * on `artists` per row and vary across a browse.
 */
export type MultiMatchResult = {
  genreName: string | undefined;
  codeLetters: string;
  codeNumber: number | null;
  artists: ArtistByCodeOwner[];
};

type ArtistSearchFormProps = {
  /**
   * Called instead of navigating when a search ends on a list: a contested
   * code, or any call-letters browse. Required rather than optional: a caller
   * that omits it has no results screen to show, and both branches would leave
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
 * A blank call number is a search, not a refusal: it composes the genre +
 * call-letters browse and ends on the same results screen the servlet's own
 * blank-number path forwarded to. Only a MALFORMED number is refused. See
 * `composeLibraryCodeSearchArgs`.
 *
 * Two divergences from the JSP, each forced by a Backend contract that has
 * no legacy equivalent:
 *
 * 1. A fully specified code with more than one owner reaches the
 *    disambiguation screen here. The legacy servlet's own fully-specified
 *    lookup ends in `findFirst()` over an unordered query, so it silently
 *    hands the librarian one arbitrary row out of a contested code and
 *    cannot tell one match from twenty-seven. `by-code` answers a list
 *    precisely so that guess is not forced.
 * 2. The compilation radio's misses route to the creation flow like the
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

  const captureSearch = (
    outcome: LibraryCodeSearchOutcome,
    props: Record<string, unknown> = {},
  ) =>
    safeCapture(CHOOSER_EVENTS.CODE_SEARCH, {
      outcome,
      call_letter_mode: callLetterMode,
      // Carried on EVERY ending, refusals included. Without it the two
      // `rockCompLetters` refusals are indistinguishable: `validateArtistSearchForm`
      // raises a different message for genre 11 than for genre 12, and both
      // collapse to the one `rock_comp_letter_required` token. Refusals are also
      // the half of a search that cannot be re-run from its own event, so they
      // are the half that most needs its coordinates.
      genre_id: effectiveGenreId,
      ...props,
    });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const result = validateArtistSearchForm({
      callLetterMode,
      artistLettersTextbox,
      rockCompLetters,
      genreId: effectiveGenreId,
    });

    if (!result.valid) {
      captureSearch("refused", { refusal: REFUSAL_BY_VALIDATION_FIELD[result.field] });
      setValidationMessage(result.message);
      return;
    }

    setValidationMessage(null);

    const composed = composeLibraryCodeSearchArgs(
      {
        callLetterMode,
        artistLettersTextbox,
        artistNumbersTextbox,
        genreId: effectiveGenreId,
      },
      // This screen has somewhere to put a whole bucket -- the JSP's own
      // results screen, which its blank-number path forwarded to. The move
      // screen deliberately does not opt in; see the composer's doc.
      { allowBucketBrowse: true },
    );

    if (!composed.ready) {
      captureSearch("refused", { refusal: composed.reason });
      setValidationMessage(composed.message);
      return;
    }

    // An absent number is the browse -- see `composeLibraryCodeSearchArgs`.
    // Read once here because every branch below turns on it.
    const browsing = composed.args.code_number === undefined;

    // Every ending below describes the same composed search, so it travels
    // with all of them rather than being spelled out per branch. `code_number`
    // is explicitly `null` on a browse rather than left off: the two endings
    // a browse shares with the fully-specified arm (`genre_not_found`,
    // `lookup_untrusted`) would otherwise be told apart only by the absence of
    // a property, which reads the same as a capture that dropped it.
    const searched = {
      genre_id: composed.args.genre_id,
      code_letters: composed.args.code_letters,
      code_number: composed.args.code_number ?? null,
      // Named to match the results screen's own events, so a search can be
      // joined to the arrival it produced without translating one concept
      // across two property names.
      browse: browsing,
    };

    // Deciding what a *successful* answer means stays outside the guard, so a
    // throw from `router.push` or `onMultiMatch` surfaces as itself rather
    // than being reported as a lookup the librarian should retry.
    let owners: ArtistByCodeOwner[] | null;
    try {
      owners = (await resolveArtistByCode(composed.args).unwrap()).artists;
    } catch (err) {
      const reason = resolveArtistByCodeErrorReason(err);

      // Unreachable from a browse: it names no single code to be unassigned,
      // and Backend answers an empty bucket with a 200 instead. The narrowing
      // is what lets the creation URL below carry a number at all.
      if (reason === "code_not_assigned" && composed.args.code_number !== undefined) {
        captureSearch("not_assigned", searched);
        const params = new URLSearchParams({
          genre_id: String(composed.args.genre_id),
          code_letters: composed.args.code_letters,
          code_number: String(composed.args.code_number),
        });
        router.push(`/dashboard/library/artist/new?${params.toString()}`);
        return;
      }

      if (reason === "genre_not_found") {
        captureSearch("genre_not_found", searched);
        setValidationMessage(
          `No genre in the catalog has id ${composed.args.genre_id}, so this code can't be looked up.`,
        );
        return;
      }

      // A validation failure, a 5xx, or an outage: refuse to act rather than
      // guess -- see resolveArtistByCodeErrorReason's doc.
      captureSearch("lookup_untrusted", searched);
      setValidationMessage(UNTRUSTWORTHY_CODE_ANSWER_MESSAGE);
      return;
    }

    // An unreadable body, not an empty bucket: the endpoint hands back `null`
    // rather than folding the two together precisely so this arm can refuse
    // it. Checked before the outcome is named, so an outage is never reported
    // as `browse_empty`.
    if (owners === null) {
      captureSearch("lookup_untrusted", searched);
      setValidationMessage(UNTRUSTWORTHY_CODE_ANSWER_MESSAGE);
      return;
    }

    // Every ending is reached at the same point with the same facts, so the
    // arm and the count name the outcome once rather than being restated as a
    // literal per branch -- where `0` and `1` could only ever be wrong.
    captureSearch(
      browsing
        ? owners.length === 0
          ? "browse_empty"
          : "browse_results"
        : owners.length === 0
          ? "empty_owner_list"
          : owners.length === 1
            ? "single_owner"
            : "multi_match",
      { ...searched, owner_count: owners.length },
    );

    const genreName = genres?.find((genre) => genre.id === composed.args.genre_id)?.genre_name;

    // A browse always ends on the results screen, at every size. One artist is
    // a list of one, not a redirect: the librarian asked what is filed under
    // these letters, and the servlet forwards to `multipleArtistsDisplay.jsp`
    // whatever the count. Zero is the screen's own no-results branch -- unused
    // call letters are a normal answer, and the refusal below would tell the
    // librarian to retry a lookup that already succeeded.
    if (browsing) {
      onMultiMatch({
        genreName,
        codeLetters: composed.args.code_letters,
        codeNumber: null,
        artists: owners,
      });
      return;
    }

    // Fully specified only. Here a 200 with no owners is a shape the contract
    // never produces -- an unassigned code is a 404 carrying
    // `code_not_assigned` -- so the answer cannot be trusted and is refused
    // like any other malformed one: routing to the creation flow would file a
    // duplicate, and the disambiguation screen would assert the code exists
    // with nobody holding it. The browse above is deliberately outside this
    // guard, because there an empty list is the truth.
    if (owners.length === 0) {
      setValidationMessage(UNTRUSTWORTHY_CODE_ANSWER_MESSAGE);
      return;
    }

    if (owners.length === 1) {
      // The owner's own genre, so the card shows the shelf this lookup asked
      // about. A code is genre-scoped -- `Rock IS 13` and `Hiphop IS 1` are two
      // unrelated bands on one artist row -- so an unscoped link would answer a
      // fully-specified code with whichever membership sorts lowest.
      router.push(artistCardHref(owners[0], owners[0].genre_id));
      return;
    }

    onMultiMatch({
      genreName,
      codeLetters: composed.args.code_letters,
      codeNumber: composed.args.code_number ?? null,
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
