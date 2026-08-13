"use client";

import { useId, useState } from "react";
import {
  useAddArtistMutation,
  useGetGenresQuery,
  useLazyPeekArtistCodeQuery,
} from "@/lib/features/catalog/api";
import { validateNewArtistNames } from "@/lib/features/catalog/chooserValidation";
import {
  isAddArtistConflict,
  parseRequiredPositiveInt,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import type { AddArtistRequestBody } from "@/lib/features/catalog/types";

const CODE_LETTERS_MAX_LENGTH = 4;

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
 * collects them, previewing the assigned code via `peek-code` the same way
 * the modern `ArtistAddForm` does.
 */
export default function NewArtistForm() {
  const genreFieldId = useId();
  const presentationNameId = useId();
  const alphabeticalNameId = useId();
  const codeLettersId = useId();
  const codeNumberId = useId();

  const { data: genres } = useGetGenresQuery();
  const [addArtist, { isLoading }] = useAddArtistMutation();
  const [peekArtistCode, { data: peekData }] = useLazyPeekArtistCodeQuery();

  const [presentationName, setPresentationName] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");
  const [genreId, setGenreId] = useState<number | null>(null);
  const [codeLetters, setCodeLetters] = useState("");
  const [codeNumberRaw, setCodeNumberRaw] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [added, setAdded] = useState<{ code_letters: string; code_number: number } | null>(null);

  const codeNumber = parseRequiredPositiveInt(codeNumberRaw);

  const resetFields = () => {
    setPresentationName("");
    setAlphabeticalName("");
    setGenreId(null);
    setCodeLetters("");
    setCodeNumberRaw("");
    setValidationMessage(null);
  };

  // The JSP's "Reset values" button also discards the last confirmation, but
  // a successful submit's own field-clearing must not: it would erase the
  // "Added as ..." message in the same render that produced it.
  const handleResetClick = () => {
    resetFields();
    setAdded(null);
  };

  const handleCodeLettersChange = (value: string) => {
    const normalized = value.toUpperCase();
    setCodeLetters(normalized);
    setAdded(null);
    if (normalized.trim() && genreId != null) {
      peekArtistCode({ code_letters: normalized.trim(), genre_id: genreId }, true);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAdded(null);

    const nameResult = validateNewArtistNames(presentationName, alphabeticalName);
    if (!nameResult.valid) {
      setValidationMessage(nameResult.message);
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
      const result = await addArtist(body).unwrap();
      setAdded({
        code_letters: result.code_letters ?? body.code_letters,
        code_number: result.code_number ?? body.code_number,
      });
      resetFields();
    } catch (err) {
      if (isAddArtistConflict(err)) {
        setValidationMessage(
          `${err.data.artist.artist_name} already holds that library code.`,
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
                disabled={isLoading}
                onChange={(e) => {
                  setGenreId(e.target.value ? Number(e.target.value) : null);
                  setAdded(null);
                }}
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
                onChange={(e) => {
                  setCodeNumberRaw(e.target.value);
                  setAdded(null);
                }}
                size={3}
              />
              {peekData && codeLetters.trim() && genreId != null && (
                <span>
                  &nbsp;Next code: {peekData.next_code_number}
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
              {added && (
                <div role="status">
                  Added as {added.code_letters}
                  {added.code_number}.
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      <input type="submit" value="Submit" disabled={isLoading} />
      &nbsp;&nbsp;&nbsp;&nbsp;
      <input type="button" value="Reset values" onClick={handleResetClick} disabled={isLoading} />
    </form>
  );
}
