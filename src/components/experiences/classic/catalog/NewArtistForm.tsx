"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import {
  useAddArtistMutation,
  useGetGenresQuery,
  useLazyPeekArtistCodeQuery,
} from "@/lib/features/catalog/api";
import { validateNewArtistNames } from "@/lib/features/catalog/chooserValidation";
import {
  CODE_LETTERS_MAX_LENGTH,
  codeLettersTooLong,
  isAddArtistConflict,
  isArtistNameConflictData,
  normalizeCodeLetters,
  parseRequiredPositiveInt,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import type { AddArtistRequestBody, PeekArtistCodeQuery } from "@/lib/features/catalog/types";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

const PEEK_DEBOUNCE_MS = 150;

const MISSING_CODE_NUMBER_MESSAGE = "You must enter a code number.";

/**
 * `ArtistAdminServlet:188`. This form posts `mode=addArtistLibraryCode`
 * (`chooseLibraryCodeOrArtist.jsp:62`) -- the same handler
 * `createLibraryCode.jsp` submits to -- which lands on the new artist's card
 * carrying "The artist/library code below has been added to the database."
 * `created=1` selects that fixed message on the card rather than putting its
 * text in the URL.
 */
// Routed by `code_letters`, not hard-coded to the artist card: a
// compilation code created here is a V/A row, and the artist card would
// only redirect to the bucket card — dropping the `created` flag, and with
// it the confirmation this push exists to deliver.
const successDestination = (artistId: number, codeLetters: string) =>
  `${artistCardHref({ id: artistId, code_letters: codeLetters })}?created=1`;

/**
 * Reproduces `chooseLibraryCodeOrArtist.jsp`'s `newArtistForm`: presentation
 * name + alphabetical name, in that order, with the JSP's exact validation
 * messages.
 *
 * Divergence from the JSP, forced by the Backend contract: the JSP submits
 * this form with `genreID=0` and empty call letters/numbers — tubafrenzy's
 * legacy backend accepts an artist with no library code at all. Backend-
 * Service's `POST /library/artists` requires `genre_id`, `code_letters`, and
 * `code_number` (see `AddArtistRequestBody`), so this form additionally
 * collects them — filling the code number from `peek-code` so that leaving the
 * field alone files the next free number in the series.
 *
 * The lookup debounces call letters and genre together as one composed value,
 * same as `CallLetterPeekControl` (which this form cannot import directly — it
 * renders MUI Joy, and classic renders none) — a genre change alone must
 * invalidate a number fetched under the previous genre just as surely as a
 * letters edit does, since the field is what gets submitted.
 */
export default function NewArtistForm() {
  const router = useRouter();
  const genreFieldId = useId();
  const presentationNameId = useId();
  const alphabeticalNameId = useId();
  const codeLettersId = useId();
  const codeNumberId = useId();

  const genresQuery = useGetGenresQuery();
  const {
    data: genres,
    isFetching: genresFetching,
    refetch: refetchGenres,
  } = genresQuery;
  const [addArtist, { isLoading }] = useAddArtistMutation();
  // See isGenresUnavailable's doc for the cached-list trap: `isError` can be
  // true while a good cached list is still on screen, so this reads
  // absence-of-list, never the error flag.
  const genresUnavailable = isGenresUnavailable(genresQuery);
  const [peekArtistCode, { data: peekData, isFetching: peekFetching }] =
    useLazyPeekArtistCodeQuery();

  const [presentationName, setPresentationName] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");
  const [genreId, setGenreId] = useState<number | null>(null);
  const [codeLetters, setCodeLetters] = useState("");
  // `null` means untouched, which is the only state in which the form may
  // supply a code number: the moment the librarian types one, that text owns
  // the field and no later-arriving peek may displace it. Holding the typed
  // text rather than seeding this state from the peek keeps one authoritative
  // owner for the value, so a call-letters or genre edit re-derives the new
  // series' number instead of leaving the previous series' number behind in a
  // second copy.
  const [typedCodeNumber, setTypedCodeNumber] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  // True only while a submit is waiting on the form's own number, which is the
  // one stretch where the button is live but the mutation has not started.
  const [resolvingCodeNumber, setResolvingCodeNumber] = useState(false);

  const trimmedCodeLetters = codeLetters.trim();
  // Computed live rather than left to the submit-time check below, so the
  // refusal is visible the moment the field goes over -- see the input's own
  // comment for why nothing here uses `maxLength`.
  const codeLettersOverLength = codeLettersTooLong(trimmedCodeLetters);
  const peekArg: PeekArtistCodeQuery | null = useMemo(
    () =>
      trimmedCodeLetters && genreId != null
        ? { code_letters: trimmedCodeLetters, genre_id: genreId }
        : null,
    [trimmedCodeLetters, genreId],
  );
  const debouncedPeekArg = useDebouncedValue(peekArg, PEEK_DEBOUNCE_MS);
  // The debounced value lags peekArg for PEEK_DEBOUNCE_MS after every change
  // (letters OR genre); treat that window as stale rather than rendering the
  // previous pair's code number as though it were current.
  const peekStale = debouncedPeekArg !== peekArg;

  useEffect(() => {
    if (!debouncedPeekArg) return;
    peekArtistCode(debouncedPeekArg, true);
  }, [debouncedPeekArg, peekArtistCode]);

  // The answer describes the (call letters, genre) pair it was asked about, and
  // a number from the wrong series is not merely out of date -- that series has
  // already issued it. These two flags suppress the previous pair's number
  // across the debounce window and across the request itself. They do not close
  // the single render on which `debouncedPeekArg` catches up: `peekStale` is
  // false by then and the lazy query has not yet raised `peekFetching`, so the
  // previous answer is derived for that one frame. Left open deliberately --
  // closing it means restructuring the query for a window one render wide.
  const peekedCodeNumber =
    peekArg && !peekStale && !peekFetching && peekData?.next_code_number != null
      ? String(peekData.next_code_number)
      : "";

  // The next free number in a series is a fact only the catalog holds, so
  // showing it beside a field the librarian still has to fill leaves him
  // copying it across by hand. Leaving the field alone files it.
  //
  // An emptied field falls back rather than counting as his answer: clearing is
  // half of the clear-and-retype gesture any pre-filled box invites, and
  // reading that empty moment as "file nothing" would switch the autofill off
  // for the life of the form. The deliberate consequence is that while an
  // answer is in hand the field cannot be left empty -- clearing it asks for
  // the default back. It goes empty only when the lookup has none, which is
  // exactly where the existing validation should fire.
  const codeNumberRaw = typedCodeNumber || peekedCodeNumber;
  const codeNumber = parseRequiredPositiveInt(codeNumberRaw);

  // Whether the field is showing the catalog's number rather than one he
  // entered. Drives select-on-focus, and decides whether a submit has anything
  // to wait for.
  const codeNumberIsPeeked = !typedCodeNumber;

  // The message names a field the form fills on its own, so it has to retract
  // the moment a number is there rather than standing red over a value that is
  // already correct until the next submit re-runs validation.
  const shownValidationMessage =
    validationMessage === MISSING_CODE_NUMBER_MESSAGE && codeNumber !== null
      ? null
      : validationMessage;

  const resetFields = () => {
    setPresentationName("");
    setAlphabeticalName("");
    setGenreId(null);
    setCodeLetters("");
    setTypedCodeNumber(null);
    setValidationMessage(null);
  };

  const handleCodeLettersChange = (value: string) => {
    setCodeLetters(normalizeCodeLetters(value));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const nameResult = validateNewArtistNames(presentationName, alphabeticalName);
    if (!nameResult.valid) {
      setValidationMessage(nameResult.message);
      return;
    }
    // A list that goes away under a held selection leaves the dropdown
    // showing its placeholder while `genreId` still names the old genre;
    // submitting would then file under a genre the form has stopped
    // displaying. The inline alert beside the select already announces the
    // outage and clears itself on recovery — writing it into
    // `validationMessage` too would render the sentence twice and leave a
    // stale copy standing after a successful retry.
    if (genresUnavailable) {
      return;
    }
    if (genreId == null) {
      setValidationMessage("You must select a genre.");
      return;
    }
    if (codeLetters.trim() === "") {
      setValidationMessage("You must enter call letters.");
      return;
    }
    // Backstop for the disabled submit button below -- an over-length value
    // must never reach `addArtist`, whatever triggered this handler.
    if (codeLettersOverLength) {
      setValidationMessage(
        `Call letters must be at most ${CODE_LETTERS_MAX_LENGTH} characters.`,
      );
      return;
    }
    // A submit landing inside the lookup window is waiting on a number the
    // form undertook to supply, not on one he forgot, so it resolves that
    // number here instead of reporting his omission. `preferCacheValue` joins
    // the request the debounce already started rather than issuing a second
    // one; when the debounce has not fired yet this is the same request a
    // moment earlier. Submit is disabled for the duration so the wait cannot
    // be double-clicked into two POSTs.
    let submittedCodeNumber = codeNumber;
    if (submittedCodeNumber === null && codeNumberIsPeeked && peekArg) {
      setResolvingCodeNumber(true);
      try {
        const answer = await peekArtistCode(peekArg, true).unwrap();
        submittedCodeNumber = parseRequiredPositiveInt(String(answer?.next_code_number ?? ""));
      } catch {
        submittedCodeNumber = null;
      } finally {
        setResolvingCodeNumber(false);
      }
    }
    if (submittedCodeNumber === null) {
      setValidationMessage(MISSING_CODE_NUMBER_MESSAGE);
      return;
    }

    setValidationMessage(null);

    const body: AddArtistRequestBody = {
      artist_name: presentationName.trim(),
      alphabetical_name: alphabeticalName.trim(),
      code_letters: codeLetters.trim(),
      genre_id: genreId,
      code_number: submittedCodeNumber,
    };

    try {
      const created = await addArtist(body).unwrap();
      router.push(successDestination(created.id, body.code_letters));
    } catch (err) {
      // The 409 this endpoint sends has two distinct causes that call for
      // different remedies: a taken (code_letters, genre_id, code_number)
      // triple is fixed by picking a different code, but a genre-scoped
      // artist-name match means the artist already exists — no code choice
      // fixes that, the remedy is to file under the existing artist.
      // `isArtistNameConflictData` is the discriminant. A 409 this form
      // cannot name an artist from (no `artist` in the body) falls through
      // `isAddArtistConflict` to the generic fallback below instead of
      // dereferencing a field that may not be there.
      if (isAddArtistConflict(err)) {
        setValidationMessage(
          isArtistNameConflictData(err.data)
            ? `${err.data.artist.artist_name} already exists in this genre. File under the existing artist instead of picking a different code.`
            : `${err.data.artist.artist_name} already holds that library code.`,
        );
      } else {
        setValidationMessage("Failed to add artist.");
      }
    }
  };

  return (
    <form name="newArtistForm" onSubmit={handleSubmit}>
      <table cellPadding={10}>
        <tbody>
          <tr>
            <td colSpan={2}>
              <h3>
                Or you can create a brand new artist with no specific library code information.
              </h3>
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "left" }}>
              &nbsp;&nbsp;<b>New Artist:</b>
            </td>
            <td>
              <label htmlFor={presentationNameId}>
                <b>Artist Presentation Name:</b>
              </label>
              <input
                id={presentationNameId}
                type="text"
                value={presentationName}
                disabled={isLoading}
                onChange={(e) => setPresentationName(e.target.value)}
                size={35}
              />
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "left" }} />
            <td>
              <label htmlFor={alphabeticalNameId}>
                <b>Artist Alphabetical Name:</b>
              </label>
              <input
                id={alphabeticalNameId}
                type="text"
                value={alphabeticalName}
                disabled={isLoading}
                onChange={(e) => setAlphabeticalName(e.target.value)}
                size={35}
              />
            </td>
          </tr>
          {/* Not in the JSP, which hides genreID/artistLetters/artistNumbers as
              empty/zero hidden inputs — added because Backend-Service requires
              all three on POST /library/artists (see file header). */}
          <tr>
            <td style={{ textAlign: "right" }}>Genre:</td>
            <td>
              <select
                id={genreFieldId}
                aria-label="Genre"
                value={genreId ?? ""}
                disabled={isLoading || genresUnavailable}
                onChange={(e) => setGenreId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="" disabled>
                  Select genre...
                </option>
                {(genres ?? []).map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.genre_name}
                  </option>
                ))}
              </select>
              {genresUnavailable && (
                <div role="alert" className="artist-error-message">
                  Genres are unavailable, so an artist can&apos;t be filed
                  right now.{" "}
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
              <label htmlFor={codeLettersId}>Call letters:</label>
              {/* No `maxLength`: it would silently clip a paste past four
                  UTF-16 units before `handleCodeLettersChange` ever saw it,
                  submitting a wrong-but-valid-looking code with nothing
                  refused. `codeLettersOverLength` below is the visible
                  refusal instead. */}
              <input
                id={codeLettersId}
                type="text"
                value={codeLetters}
                disabled={isLoading}
                onChange={(e) => handleCodeLettersChange(e.target.value)}
                size={2}
              />
              {codeLettersOverLength && (
                <div role="alert" className="artist-error-message">
                  At most {CODE_LETTERS_MAX_LENGTH} characters
                </div>
              )}
              &nbsp;
              <label htmlFor={codeNumberId}>Call Numbers:</label>
              <input
                id={codeNumberId}
                type="text"
                value={codeNumberRaw}
                disabled={isLoading}
                onChange={(e) => setTypedCodeNumber(e.target.value)}
                onFocus={(e) => {
                  // Focus-then-type has to REPLACE a number the form supplied:
                  // appending leaves something like "712", which `size={3}`
                  // renders as a perfectly plausible call number, so a wrong
                  // code gets filed with nothing looking wrong. A number he
                  // typed is never selected -- clicking back in to fix one
                  // digit must not wipe it.
                  if (codeNumberIsPeeked) {
                    e.currentTarget.select();
                  }
                }}
                size={3}
              />
              {peekArg && (
                <span role="status" aria-live="polite">
                  &nbsp;Next code:{" "}
                  {peekStale || peekFetching ? "…" : (peekData?.next_code_number ?? "…")}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td />
            <td>
              <div
                className={`validation-message${shownValidationMessage ? " visible" : ""}`}
                role={shownValidationMessage ? "alert" : undefined}
              >
                {shownValidationMessage}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <input
        type="submit"
        value="Submit"
        disabled={isLoading || resolvingCodeNumber || codeLettersOverLength}
      />
      &nbsp;&nbsp;&nbsp;&nbsp;
      <input type="button" value="Reset values" onClick={resetFields} disabled={isLoading} />
    </form>
  );
}
