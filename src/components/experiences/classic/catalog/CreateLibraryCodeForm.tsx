"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useAddArtistMutation, useGetGenresQuery } from "@/lib/features/catalog/api";
import { validateNewArtistNames } from "@/lib/features/catalog/chooserValidation";
import {
  isAddArtistConflict,
  isArtistNameConflictData,
  normalizeCodeLetters,
  parseRequiredNonNegativeInt,
  parseRequiredPositiveInt,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import { isVariousArtists } from "@/lib/features/catalog/libraryCode";
import type { AddArtistRequestBody } from "@/lib/features/catalog/types";

type CreateLibraryCodeFormProps = {
  genreIdRaw: string;
  codeLetters: string;
  codeNumberRaw: string;
};

/**
 * `ArtistAdminServlet:188` -- `processAddArtistLibraryCode` lands on the new
 * artist's card carrying "The artist/library code below has been added to the
 * database." `created=1` selects that fixed message on the card rather than
 * putting its text in the URL.
 */
const successDestination = (artistId: number) =>
  `/dashboard/library/artist/${artistId}?created=1`;

// The heading is the servlet's message, and it has two forms
// (`ArtistAdminServlet:152-155`): a Various Artists code -- call letters
// prefixed `Z-`, which is what the chooser's compilation mode builds -- gets
// the shorter wording, because for those the librarian is filing a shelf
// bucket rather than associating a named artist.
const VARIOUS_ARTISTS_HEADING =
  "This 'Various Artists' library code does not currently exist in the database. To create it, click 'Add!'";
const ARTIST_HEADING =
  "This library code does not currently exist in the database. To create it, you need to associate it with an artist (new or existing) and click 'Add!'.";

/**
 * Reproduces `createLibraryCode.jsp`: the miss branch of
 * `findOrCreateLibraryCode` (`ArtistAdminServlet:161`) -- genre, letters, and
 * numbers arrive fixed from the miss branch and are read-only here; only the
 * two name fields are editable, matching the JSP's field order, labels, and
 * "Add!"/"Reset" button labels.
 *
 * Deliberate divergences from the JSP:
 * - The dead `Z_` V/A auto-naming branch (`:26`, testing an underscore the
 *   servlet's own prefix `Z-` never produces) is not reproduced -- see
 *   NewArtistForm's header for the same call. The servlet's *live* V/A
 *   handling is reproduced: a Various Artists code gets its own heading,
 *   matched via `isVariousArtists` rather than the servlet's own bare
 *   `Z-` prefix test, because this screen's carrying URL can arrive with
 *   either spelling -- `Z-<letter>` from a legacy-shaped link, or `V/A`, the
 *   literal Backend-Service's by-code resolution actually returns (its
 *   catalog import collapses every Rock/Soundtracks sub-bucket to that one
 *   form; see `libraryCode.ts`'s header).
 * - The servlet forwards no `artistNumbers` on its V/A branch and
 *   `processAddArtistLibraryCode` skips call numbers for `Z-` entirely, so
 *   `/wxycdb` files V/A codes with no number at all. `POST /library/artists`
 *   requires `code_number`, so a V/A code is filed here with the number it
 *   carried -- and a V/A link that carries none is refused rather than filed
 *   incomplete. That number is legitimately `0` (every Various Artists
 *   bucket is filed at `artist_genre_code = 0`), so the carried value is
 *   parsed with a floor of 0, not 1.
 *
 * The floor is 0 for any carried code, not only a V/A one, and that is why it
 * differs from `NewArtistForm`'s floor of 1 on the same column. The two forms
 * are asked different questions. There, the librarian types a code number
 * freely beside a peeked next-free value that is never 0, so a typed 0 is a
 * slip. Here, the number is not input at all: it is a code the resolver was
 * already asked about and answered `code_not_assigned` for, and both
 * `by-code` and `POST /library/artists` accept 0 for any code letters --
 * production holds a non-V/A `UNK` filed at 0. Refusing it would strand the
 * librarian on a screen reached by a search that succeeded.
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
  const codeNumber = parseRequiredNonNegativeInt(codeNumberRaw);
  const upperCodeLetters = normalizeCodeLetters(codeLetters.trim());
  const heading = isVariousArtists(upperCodeLetters) ? VARIOUS_ARTISTS_HEADING : ARTIST_HEADING;

  // Which part of the carried code is unusable, so the refusal can name it.
  // The rows below display these values verbatim like the JSP does, so a
  // message that says "missing" about a value the librarian is looking at
  // reads as a broken screen rather than a malformed link.
  const codeProblem =
    genreId == null
      ? genreIdRaw.trim() === ""
        ? "This link carries no genre."
        : `This link's genre (${genreIdRaw}) is not a genre id.`
      : upperCodeLetters === ""
        ? "This link carries no call letters."
        : codeNumber == null
          ? codeNumberRaw.trim() === ""
            ? "This link carries no call number."
            : `This link's call number (${codeNumberRaw}) is not a whole number, zero or greater.`
          : null;

  const genreName = genres?.find((genre) => genre.id === genreId)?.genre_name;
  // Absent from a list that did load: the id is real enough to parse but names
  // no genre this client knows about. Distinct from the outage and from a
  // missing param -- filing anyway would put the release under a genre the
  // librarian was never shown, and library codes carry no unique constraint
  // to catch it afterwards.
  // Only meaningful once the id itself parsed: a malformed link is a
  // different refusal, and it keeps Add! enabled so the click produces the
  // message naming what is wrong rather than a mute disabled button.
  const genreUnresolved =
    genreId != null && !genresUnavailable && genres != null && genreName == null;

  const resetFields = () => {
    setPresentationName("");
    setAlphabeticalName("");
    setValidationMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (codeProblem != null) {
      setValidationMessage(codeProblem);
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
    // cannot currently be shown the name of. Clearing first keeps a message
    // from an earlier attempt from standing beside fields that have since
    // been corrected.
    if (genresUnavailable || genreUnresolved) {
      setValidationMessage(null);
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
      const created = await addArtist(body).unwrap();
      router.push(successDestination(created.id));
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
        <h3>{heading}</h3>
      </div>
      <form name="newArtistForm" onSubmit={handleSubmit}>
        <table cellPadding={5} style={{ margin: "0 auto" }}>
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
                ) : genreUnresolved ? (
                  <span role="alert" className="artist-error-message">
                    No genre in the catalog has id {genreIdRaw}, so this code can&apos;t be filed.
                  </span>
                ) : genreName != null ? (
                  genreName
                ) : genreId == null ? (
                  // The link never carried a usable genre; submitting says so
                  // precisely, so the row just shows what did arrive.
                  genreIdRaw.trim() || "—"
                ) : (
                  // Still in flight. Naming the pending state keeps it from
                  // reading as "this code has no genre", which is a different
                  // screen with a different outcome.
                  <span>Loading…</span>
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
                {/* Disabled while the code can't be filed, so the button
                    never absorbs a click without saying anything -- the
                    banner beside Genre is the explanation in both cases. */}
                <input
                  type="submit"
                  value="Add!"
                  disabled={isLoading || genresUnavailable || genreUnresolved}
                />
                <input type="reset" value="Reset" onClick={resetFields} disabled={isLoading} />
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </div>
  );
}
