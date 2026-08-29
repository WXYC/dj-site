"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  useAddAlbumMutation,
  useGetArtistCardQuery,
  useGetArtistReleasesQuery,
  useGetFormatsQuery,
  useGetGenresQuery,
  useUpdateArtistCardMutation,
} from "@/lib/features/catalog/api";
import {
  formatArtistCodeWithPunctuation,
  formatEntireLibraryCode,
  isVariousArtists,
} from "@/lib/features/catalog/libraryCode";
import type { AddAlbumRequestBody, ArtistRelease } from "@/lib/features/catalog/types";
import {
  formatStationDateTime,
  formatStationLongDate,
} from "@/src/utilities/stationTime";

type ArtistCardProps = {
  artistId: number;
  /**
   * The confirmation `/wxycdb` carries onto this card after a create
   * (`ArtistAdminServlet:187`), shown once above the artist's name.
   */
  message?: string;
};

/** `artist-card-modify.js` `validateAddRelease`, verbatim. */
const EMPTY_TITLE_MESSAGE = "Please enter a title before adding this release.";
/** `shared/validate-names`, the same text `chooserValidation` reproduces. */
const EMPTY_ALPHABETICAL_MESSAGE = "The alphabetical name cannot be empty.";

/**
 * Reproduces `libraryAdmin/artistCardModify.jsp` -- the main working screen of
 * `/wxycdb` and the one a librarian spends the day on: the artist's details,
 * the `modifyArtist` name-edit form (`:41`), the add-release form (`:86`), and
 * the artist's release table (`:126-150`).
 *
 * Deliberate divergences, every one forced by the Backend-Service contract
 * rather than chosen -- where both the JSP's shape and a Backend-Service call
 * are possible, the JSP wins:
 *
 * - **Four of `modifyArtist`'s five fields are read-only.** `PATCH
 *   /library/artists/:id` allowlists `alphabetical_name` alone and *rejects*
 *   `artist_name`, `genre_id`, `code_letters`, and `code_artist_number` with a
 *   400 naming why. Rendering them as editable inputs would offer an
 *   edit that always fails. `artist_name` is the one that is merely deferred:
 *   renaming an artist moves the nightly catalog import's `fold_artist_name`
 *   match key while that import is still a live 30-minute cron, so it waits on
 *   that import stopping. The other three have no write path anywhere in
 *   Backend-Service.
 * - **The genre renders as text, not the JSP's `<select>`.** Same cause: with
 *   no write path, a dropdown would be a control that cannot commit.
 * - **No "Time Last Modified" row for the artist.** `GET /library/artists/:id`
 *   does not project one. Rendering a blank labelled row would read as "never
 *   modified", which is a claim, so the row is dropped instead.
 * - **No "Delete The Artist" link.** The JSP offers it only for an artist with
 *   no releases and no cross-references; Backend-Service has no delete-artist
 *   endpoint at any privilege (`DELETE /library/:id` deletes a *release*).
 * - **The add-release form does not take the release call number or volume
 *   letters.** `POST /library` derives `code_number` itself
 *   (max+1 for the artist) and has no
 *   `code_volume_letters` parameter at all, so the JSP's two inputs have
 *   nothing to submit to. The assigned code is reported back after the save
 *   instead, which is the fact the librarian actually needs -- it is what goes
 *   on the sleeve.
 * - **The add-release form gains a Label field.** `POST /library` requires
 *   `label`; the JSP's form has no such input. Same precedent as
 *   `NewArtistForm` adding genre and call letters/numbers because
 *   `POST /library/artists` requires them.
 * - **Release titles are plain text.** The JSP links each to
 *   `libraryReleaseModify.jsp`, a screen this experience does not have yet; a
 *   link would be a dead one.
 * - **The cross-reference blocks (`:157-232`) and the "Add Xrefs" links are
 *   absent.** Write-side cross-reference admin is deliberately not being
 *   rebuilt, and the read-only display is a separate, non-blocking screen.
 * - **No sortable column headers.** The JSP's `SortHeaderController` posts a
 *   sort back to the servlet; `GET /library/artists/:id/releases` takes no
 *   sort parameter and returns shelf order, which is the order the JSP itself
 *   defaults to.
 */
export default function ArtistCard({ artistId, message }: ArtistCardProps) {
  const router = useRouter();
  const alphabeticalNameId = useId();
  const presentationNameId = useId();
  const titleId = useId();
  const altArtistId = useId();
  const labelId = useId();
  const formatId = useId();

  const {
    data: artist,
    isLoading: artistLoading,
    isError: artistError,
  } = useGetArtistCardQuery(artistId);
  const {
    data: releasePage,
    isError: releasesError,
  } = useGetArtistReleasesQuery({ artistId });
  const { data: genres } = useGetGenresQuery();
  const { data: formats } = useGetFormatsQuery();

  const [updateArtist, { isLoading: savingArtist }] = useUpdateArtistCardMutation();
  const [addAlbum, { isLoading: savingRelease }] = useAddAlbumMutation();

  const [alphabeticalName, setAlphabeticalName] = useState("");
  const [artistMessage, setArtistMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [altArtistName, setAltArtistName] = useState("");
  const [label, setLabel] = useState("");
  const [formatIdValue, setFormatIdValue] = useState<number | null>(null);
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);
  const [addedCode, setAddedCode] = useState<string | null>(null);

  // Seed the one editable field from the server once the card arrives, and
  // re-seed after a save so the input shows what was stored rather than what
  // was typed -- the backend NFC-normalizes on write.
  useEffect(() => {
    if (artist) setAlphabeticalName(artist.alphabetical_name);
  }, [artist]);

  // `/wxycdb` picks this card or the compilation bucket card from the row
  // itself. A shelf row reaching this URL -- a hand-typed id, a stale
  // bookmark -- would otherwise be offered a name edit for what is a shelf
  // section, and shown none of its per-track credits.
  const isShelfRow = !!artist && isVariousArtists(artist.code_letters);
  useEffect(() => {
    if (isShelfRow) router.replace(`/dashboard/library/various/${artistId}`);
  }, [isShelfRow, router, artistId]);

  const genreName = genres?.find((genre) => genre.id === artist?.genre_id)?.genre_name;

  // `fn:trim(format.referenceName)` -- the JSP omits blank-named formats from
  // its dropdown rather than offering an unlabelled option.
  const selectableFormats = (formats ?? []).filter(
    (format) => format.format_name.trim() !== "",
  );

  const artistCode = artist
    ? formatArtistCodeWithPunctuation({
        code_letters: artist.code_letters,
        code_artist_number: artist.code_artist_number,
        genre_id: artist.genre_id,
      })
    : "";

  const handleModifyArtist = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!artist) return;

    if (alphabeticalName.trim() === "") {
      setArtistMessage(EMPTY_ALPHABETICAL_MESSAGE);
      return;
    }

    setArtistMessage(null);
    try {
      await updateArtist({
        artistId,
        body: { alphabetical_name: alphabeticalName.trim() },
      }).unwrap();
    } catch {
      setArtistMessage("Failed to modify the artist.");
    }
  };

  const handleAddRelease = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!artist) return;
    setAddedCode(null);

    if (title.trim() === "") {
      setReleaseMessage(EMPTY_TITLE_MESSAGE);
      return;
    }
    if (label.trim() === "") {
      setReleaseMessage("You must enter a label before adding this release.");
      return;
    }
    if (formatIdValue == null) {
      setReleaseMessage("You must select a format before adding this release.");
      return;
    }

    setReleaseMessage(null);

    // `artist_id`, never `artist_name`: the backend resolves a name through
    // `artistIdFromName(name, genre_id)`, which would file the release under
    // whichever artist that fuzzy match returns rather than under the card the
    // librarian is looking at.
    const body: AddAlbumRequestBody = {
      artist_id: artistId,
      genre_id: artist.genre_id,
      album_title: title.trim(),
      label: label.trim(),
      format_id: formatIdValue,
      ...(altArtistName.trim() !== ""
        ? { alternate_artist_name: altArtistName.trim() }
        : {}),
    };

    try {
      const created = await addAlbum(body).unwrap();
      const codeNumber = created.code_number;
      setAddedCode(
        typeof codeNumber === "number"
          ? formatEntireLibraryCode({
              genreName,
              code_letters: artist.code_letters,
              code_artist_number: artist.code_artist_number,
              genre_id: artist.genre_id,
              code_number: codeNumber,
              code_volume_letters:
                typeof created.code_volume_letters === "string"
                  ? created.code_volume_letters
                  : null,
            })
          : null,
      );
      setTitle("");
      setAltArtistName("");
      setLabel("");
    } catch {
      setReleaseMessage("Failed to add the release.");
    }
  };

  if (artistError) {
    return (
      <div data-testid="artist-card-error" role="alert" className="artist-error-message">
        This artist card could not be loaded.
      </div>
    );
  }

  if (artistLoading || !artist || isShelfRow) {
    return <div role="status">Loading…</div>;
  }

  const releases = releasePage?.releases ?? [];
  const total = releasePage?.total ?? 0;

  return (
    <>
      {/* `:26-27`. The third link -- "Add Cross-References From This Artist" --
          is dropped with the xref blocks below. */}
      <div className="label" style={{ textAlign: "center" }}>
        <Link href="/dashboard/catalog" legacyBehavior={false}>
          Do another search
        </Link>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <Link href="/dashboard/library" legacyBehavior={false}>
          Find and Create an Artist and/or Library Code
        </Link>
      </div>

      <div style={{ textAlign: "center" }}>
        <h3>ARTIST:&nbsp;{artist.artist_name}&nbsp;</h3>
      </div>
      {message && (
        <div style={{ textAlign: "center" }} role="status">
          <h5>&nbsp;{message}&nbsp;</h5>
        </div>
      )}
      <hr />

      <form
        name="modifyArtist"
        data-testid="modify-artist-form"
        onSubmit={handleModifyArtist}
      >
        <table cellPadding={5} style={{ margin: "0 auto" }}>
          <tbody>
            <tr>
              <td />
              <td>
                <b>Modify the Artist:</b>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <label htmlFor={presentationNameId}>
                  <b>Artist Presentation Name:</b>
                </label>
              </td>
              <td>
                {/* readOnly rather than removed: the name is the thing the
                    librarian is checking against the card in their hand, so it
                    has to stay legible -- a disabled input greys it out. */}
                <input
                  id={presentationNameId}
                  type="text"
                  size={50}
                  value={artist.artist_name}
                  readOnly
                />
                <div className="label">
                  Renaming an artist is not available here yet — the nightly
                  catalog import still owns this field.
                </div>
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
                  size={50}
                  value={alphabeticalName}
                  disabled={savingArtist}
                  onChange={(e) => setAlphabeticalName(e.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Genre:</b>
              </td>
              <td>{genreName ?? "…"}</td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Artist Call Letters:</b>
              </td>
              <td>{artist.code_letters}</td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Artist Call Number:</b>
              </td>
              <td>{artist.code_artist_number}</td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b># of releases:</b>
              </td>
              {/* The server's total, not `releases.length`: the table is
                  paginated, so the row count is a page size. */}
              <td>{total}</td>
            </tr>
            <tr>
              <td />
              <td>
                <div
                  className={`validation-message${artistMessage ? " visible" : ""}`}
                  role={artistMessage ? "alert" : undefined}
                >
                  {artistMessage}
                </div>
              </td>
            </tr>
            <tr>
              <td />
              <td>
                <input type="submit" value="Modify This Artist" disabled={savingArtist} />
              </td>
            </tr>
          </tbody>
        </table>
      </form>

      <hr />

      <form name="addRelease" data-testid="add-release-form" onSubmit={handleAddRelease}>
        <table cellPadding={5} style={{ margin: "0 auto" }}>
          <tbody>
            <tr>
              <td />
              <td>
                <b>Add a Library Release for This Artist:</b>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Library Code:</b>
              </td>
              <td>
                {genreName ?? ""}
                {artistCode}
                <span className="label">
                  &nbsp;— the release number is assigned when you save.
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <label htmlFor={titleId}>
                  <b>Title of Release:</b>
                </label>
              </td>
              <td>
                <input
                  id={titleId}
                  type="text"
                  size={50}
                  value={title}
                  disabled={savingRelease}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <label htmlFor={altArtistId}>
                  <b>Alternate Artist Name:</b>
                </label>
              </td>
              <td>
                <input
                  id={altArtistId}
                  type="text"
                  size={50}
                  value={altArtistName}
                  disabled={savingRelease}
                  onChange={(e) => setAltArtistName(e.target.value)}
                />
              </td>
            </tr>
            {/* Not in the JSP -- POST /library requires `label`. */}
            <tr>
              <td style={{ textAlign: "right" }}>
                <label htmlFor={labelId}>
                  <b>Label:</b>
                </label>
              </td>
              <td>
                <input
                  id={labelId}
                  type="text"
                  size={50}
                  value={label}
                  disabled={savingRelease}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <label htmlFor={formatId}>
                  <b>Format:</b>
                </label>
              </td>
              <td>
                <select
                  id={formatId}
                  value={formatIdValue ?? ""}
                  disabled={savingRelease || selectableFormats.length === 0}
                  onChange={(e) =>
                    setFormatIdValue(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  {selectableFormats.map((format) => (
                    <option key={format.id} value={format.id}>
                      {format.format_name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            <tr>
              <td />
              <td>
                <div
                  className={`validation-message${releaseMessage ? " visible" : ""}`}
                  role={releaseMessage ? "alert" : undefined}
                >
                  {releaseMessage}
                </div>
                {addedCode && (
                  <div role="status">Filed as {addedCode}.</div>
                )}
              </td>
            </tr>
            <tr>
              <td />
              <td>
                <input
                  type="submit"
                  value="Add a new Library Release"
                  disabled={savingRelease}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </form>

      <hr />

      {releasesError ? (
        <div
          data-testid="release-table-error"
          role="alert"
          className="artist-error-message"
        >
          This artist&apos;s releases could not be loaded, so this is not a
          complete list of what is on the shelf.
        </div>
      ) : (
        <table className="entry-table" data-testid="artist-release-table">
          <tbody>
            {releases.length > 0 ? (
              <>
                <tr className="entry-header">
                  <th style={{ textAlign: "left" }}>Time Last Modified</th>
                  <th style={{ textAlign: "left" }}>Format</th>
                  <th style={{ textAlign: "left" }}>Code</th>
                  <th style={{ textAlign: "left" }}>Title of Release</th>
                  <th style={{ textAlign: "left" }}>Alternate Artist Name</th>
                </tr>
                {releases.map((release: ArtistRelease, index: number) => (
                  <tr
                    key={release.id}
                    className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}
                  >
                    <td style={{ textAlign: "center" }}>
                      {formatStationDateTime(release.last_modified).time},{" "}
                      {formatStationLongDate(release.last_modified)}
                    </td>
                    <td>{release.format_name}</td>
                    <td>
                      {formatEntireLibraryCode({
                        genreName: genres?.find((g) => g.id === release.genre_id)
                          ?.genre_name,
                        code_letters: release.code_letters,
                        code_artist_number: release.code_artist_number,
                        genre_id: release.genre_id,
                        code_number: release.code_number,
                        code_volume_letters: release.code_volume_letters,
                      })}
                    </td>
                    <td>{release.album_title}</td>
                    <td>{release.alternate_artist_name}</td>
                  </tr>
                ))}
              </>
            ) : (
              <tr className="entry-header">
                <th colSpan={5} style={{ textAlign: "center" }}>
                  The artist does not have any library releases
                </th>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* The JSP pages this table through `queryResultsSubset`; the endpoint
          pages too, and a librarian with more releases than one page must be
          told rather than shown a silently truncated shelf. */}
      {total > releases.length && (
        <div className="label" style={{ textAlign: "center" }}>
          Showing the first {releases.length} of {total} releases.
        </div>
      )}
    </>
  );
}
