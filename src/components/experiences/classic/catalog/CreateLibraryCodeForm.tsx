"use client";

import { useId } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAddArtistMutation, useGetGenresQuery } from "@/lib/features/catalog/api";
import { validateNewArtistNames } from "@/lib/features/catalog/chooserValidation";
import {
  isAddArtistConflict,
  isArtistNameConflictData,
  parseRequiredPositiveInt,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import type { AddArtistRequestBody } from "@/lib/features/catalog/types";

type CreateLibraryCodeFormProps = {
  genreIdRaw: string;
  codeLetters: string;
  codeNumberRaw: string;
};

const INTERIM_SUCCESS_DESTINATION = "/dashboard/library";

/**
 * Reproduces `createLibraryCode.jsp`: the miss branch of
 * `findOrCreateLibraryCode` (`ArtistAdminServlet:161`) -- genre, letters, and
 * numbers arrive fixed from the miss branch and are read-only here; only the
 * two name fields are editable, matching the JSP's field order, labels, and
 * "Add!"/"Reset" button labels.
 *
 * Divergences from the JSP, both forced and both enumerated in the PR:
 * - The dead `Z_` V/A auto-naming branch (`:26`, testing an underscore the
 *   servlet's own prefix `Z-` never produces) is not reproduced -- see
 *   NewArtistForm's header for the same call.
 * - The JSP's successful submit lands on the artist card
 *   (`goToArtistModifyCard`). That page doesn't exist yet (WXYC/dj-site#1166
 *   is deploy-gated), so this interim build lands where the chooser's own
 *   create path already lands today -- `/dashboard/library` -- and will move
 *   to the card once 1166 ships.
 *
 * Genre display follows `isGenresUnavailable`'s convention: an unissued or
 * failed genres request renders an explicit unavailable state, never a blank
 * or a guessed name, even though `genreIdRaw` itself came from the URL and
 * needs no selection here.
 */
export default function CreateLibraryCodeForm({
  genreIdRaw,
  codeLetters,
  codeNumberRaw,
}: CreateLibraryCodeFormProps) {
  const presentationNameId = useId();
  const alphabeticalNameId = useId();
  const router = useRouter();

  const genresQuery = useGetGenresQuery();
  const {
    data: genres,
    isFetching: genresFetching,
    refetch: refetchGenres,
  } = genresQuery;
  const genresUnavailable = isGenresUnavailable(genresQuery);
  const [addArtist, { isLoading }] = useAddArtistMutation();

  const [presentationName, setPresentationName] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const genreId = parseRequiredPositiveInt(genreIdRaw);
  const codeNumber = parseRequiredPositiveInt(codeNumberRaw);
  const upperCodeLetters = codeLetters.trim().toUpperCase();
  const codeIncomplete = genreId == null || upperCodeLetters === "" || codeNumber == null;

  const genreName = genres?.find((genre) => genre.id === genreId)?.genre_name;

  const resetFields = () => {
    setPresentationName("");
    setAlphabeticalName("");
    setValidationMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (codeIncomplete) {
      setValidationMessage(
        "This link is missing genre, call letters, or call number information.",
      );
      return;
    }

    const nameResult = validateNewArtistNames(presentationName, alphabeticalName);
    if (!nameResult.valid) {
      setValidationMessage(nameResult.message);
      return;
    }

    // See isGenresUnavailable's doc for the cached-list trap: `genreId`
    // already carries a valid id from the URL, but the outage banner is the
    // one place that announces the backend is down, and a submit that
    // slipped past it would file silently against a genre the librarian
    // cannot currently be shown the name of.
    if (genresUnavailable) {
      return;
    }

    setValidationMessage(null);

    const body: AddArtistRequestBody = {
      artist_name: presentationName.trim(),
      alphabetical_name: alphabeticalName.trim(),
      code_letters: upperCodeLetters,
      genre_id: genreId as number,
      code_number: codeNumber as number,
    };

    try {
      await addArtist(body).unwrap();
      router.push(INTERIM_SUCCESS_DESTINATION);
    } catch (err) {
      // Same discriminant as NewArtistForm's addArtist rejection handling:
      // a taken (code_letters, genre_id, code_number) triple is fixed by
      // picking a different code, but a genre-scoped artist-name match means
      // the artist already exists -- no code choice fixes that.
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
    <div data-testid="create-library-code-form">
      <div style={{ textAlign: "center" }}>
        <h3>
          This library code does not currently exist in the database. To create it, you need to
          associate it with an artist (new or existing) and click &apos;Add!&apos;.
        </h3>
      </div>
      <form name="newArtistForm" onSubmit={handleSubmit}>
        <table cellPadding={5}>
          <tbody>
            <tr>
              <td />
              <td>
                <b>Add a Library Code to The Database:</b>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Genre:</b>
              </td>
              <td>
                {genresUnavailable ? (
                  <span role="alert" className="artist-error-message">
                    Genres are unavailable, so this code can&apos;t be filed right now.{" "}
                    <button
                      type="button"
                      disabled={genresFetching}
                      onClick={() => refetchGenres()}
                    >
                      Try again
                    </button>
                  </span>
                ) : (
                  (genreName ?? "—")
                )}
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Artist Letters:</b>
              </td>
              <td>{upperCodeLetters || "—"}</td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Artist Numbers:</b>
              </td>
              <td>{codeNumberRaw || "—"}</td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <label htmlFor={presentationNameId}>
                  <b>Artist Presentation Name:</b>
                </label>
              </td>
              <td>
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
              <td style={{ textAlign: "right" }}>
                <label htmlFor={alphabeticalNameId}>
                  <b>Artist Alphabetical Name:</b>
                </label>
              </td>
              <td>
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
            <tr>
              <td />
              <td>
                <input type="submit" value="Add!" disabled={isLoading} />
                <input type="reset" value="Reset" onClick={resetFields} disabled={isLoading} />
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </div>
  );
}
