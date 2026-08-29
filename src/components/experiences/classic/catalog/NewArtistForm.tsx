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
  isAddArtistConflict,
  isArtistNameConflictData,
  normalizeCodeLetters,
  parseRequiredPositiveInt,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import type { AddArtistRequestBody, PeekArtistCodeQuery } from "@/lib/features/catalog/types";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

const PEEK_DEBOUNCE_MS = 150;

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
 * collects them, previewing the assigned code via `peek-code`.
 *
 * The preview debounces call letters and genre together as one composed
 * value, same as `CallLetterPeekControl` (which this form cannot import
 * directly — it renders MUI Joy, and classic renders none) — a genre
 * change alone must invalidate a preview typed under the previous genre just
 * as surely as a letters edit does, or the number shown briefly names the
 * previous genre's series instead of the one about to be submitted.
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
  const [codeNumberRaw, setCodeNumberRaw] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const codeNumber = parseRequiredPositiveInt(codeNumberRaw);

  const trimmedCodeLetters = codeLetters.trim();
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

  const resetFields = () => {
    setPresentationName("");
    setAlphabeticalName("");
    setGenreId(null);
    setCodeLetters("");
    setCodeNumberRaw("");
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
    if (codeNumber === null) {
      setValidationMessage("You must enter a code number.");
      return;
    }

    setValidationMessage(null);

    const body: AddArtistRequestBody = {
      artist_name: presentationName.trim(),
      alphabetical_name: alphabeticalName.trim(),
      code_letters: codeLetters.trim(),
      genre_id: genreId,
      code_number: codeNumber,
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
              <input
                id={codeLettersId}
                type="text"
                value={codeLetters}
                disabled={isLoading}
                onChange={(e) => handleCodeLettersChange(e.target.value)}
                size={2}
                maxLength={CODE_LETTERS_MAX_LENGTH}
              />
              &nbsp;
              <label htmlFor={codeNumberId}>Call Numbers:</label>
              <input
                id={codeNumberId}
                type="text"
                value={codeNumberRaw}
                disabled={isLoading}
                onChange={(e) => setCodeNumberRaw(e.target.value)}
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
                className={`validation-message${validationMessage ? " visible" : ""}`}
                role={validationMessage ? "alert" : undefined}
              >
                {validationMessage}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <input type="submit" value="Submit" disabled={isLoading} />
      &nbsp;&nbsp;&nbsp;&nbsp;
      <input type="button" value="Reset values" onClick={resetFields} disabled={isLoading} />
    </form>
  );
}
