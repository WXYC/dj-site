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

type VariousArtistsCardProps = {
  artistId: number;
  /** The servlet's fixed post-create confirmation, when the librarian arrived from a create. */
  message?: string;
};

/**
 * The umbrella bucket. `/wxycdb` hides the add-release form for this one row
 * alone: it is a catch-all that collects releases which belong to no lettered
 * sub-shelf, so filing a *new* release into it would put the release somewhere
 * no librarian can find it on the physical shelf. Reading it stays available —
 * what is already in there has to remain visible.
 *
 * The literal is the JSP's own (`variousArtistsCardModify.jsp:46` tests
 * `artist.ID != 19923`), not a value chosen here, so it is reproduced rather
 * than replaced by a derived rule — the shelf has no other property that marks
 * the umbrella, and inventing one would diverge from the spec on the one row
 * it governs. It is a serial, though, so it identifies the umbrella only in a
 * database whose `artists` rows came from the tubafrenzy catalog: production
 * and its clones. Against a freshly seeded local database the id simply does
 * not exist, so the guard never fires and every bucket shows the form; that
 * is the failure mode to expect there, and it is not a filing hazard in a
 * database with no real shelf behind it.
 */
const UMBRELLA_BUCKET_ARTIST_ID = 19923;

/** `artist-card-modify.js` `validateAddRelease`, verbatim. */
const EMPTY_TITLE_MESSAGE = "Please enter a title before adding this release.";

/**
 * Reproduces `libraryAdmin/variousArtistsCardModify.jsp` — the compilation
 * shelf's bucket page. The shelf is one `code_letters = 'V/A'` code subdivided
 * by letter across 53 artist rows, and each row is its own physical section;
 * this screen is that section's card.
 *
 * The bucket header is read-only by design, not by omission: the JSP wraps its
 * two rows in a `modifyArtist` form that carries no editable input and no
 * submit button, so it renders as a table here. Preserving the subdivision is
 * a filing invariant — the letter split *is* the shelf organization, so the 52
 * lettered rows must never be collapsed into one bucket.
 *
 * Deliberate divergences, each forced by the Backend-Service contract rather
 * than chosen — where both the JSP's shape and a Backend-Service call are
 * possible, the JSP wins:
 *
 * - **The Album Artist field cannot be written.** The JSP's V/A-specific
 *   `albumArtist` input is the one field this screen has that the ordinary
 *   artist card does not, and `POST /library` has no parameter for it:
 *   `library.album_artist` is populated only by the nightly catalog import.
 *   The row is kept, with its purpose stated, rather than rendered as an input
 *   that silently discards what the librarian types — the credited album
 *   artist is the field compilations are filed against, so dropping the value
 *   without saying so would lose exactly the information this screen exists to
 *   capture. It becomes an input once a write path exists.
 * - **The two library-code inputs are dropped.** `POST /library` derives
 *   `code_number` itself (max+1 for the bucket) and has no
 *   `code_volume_letters` parameter, so the JSP's `releaseCallNumbers` and
 *   `releaseCallLetters` boxes have nothing to submit to. The assigned code is
 *   reported after the save instead, which is the fact that goes on the sleeve.
 * - **The form gains a Label field.** `POST /library` requires `label` and the
 *   JSP's form has no such input; same precedent as the ordinary artist card.
 * - **No sort form.** The JSP posts `sortColumn`/`sortOrder` back to the
 *   servlet; `GET /library/artists/:id/releases` takes no sort parameter and
 *   returns shelf order, which is the order the JSP itself defaults to.
 */
export default function VariousArtistsCard({ artistId, message }: VariousArtistsCardProps) {
  const router = useRouter();
  const titleId = useId();
  const altArtistId = useId();
  const labelId = useId();
  const formatId = useId();

  const {
    data: artist,
    isLoading: artistLoading,
    isError: artistError,
  } = useGetArtistCardQuery(artistId);
  const { data: releasePage, isError: releasesError } = useGetArtistReleasesQuery({
    artistId,
  });
  const { data: genres } = useGetGenresQuery();
  const { data: formats } = useGetFormatsQuery();

  const [addAlbum, { isLoading: savingRelease }] = useAddAlbumMutation();

  const [title, setTitle] = useState("");
  const [altArtistName, setAltArtistName] = useState("");
  const [label, setLabel] = useState("");
  const [formatIdValue, setFormatIdValue] = useState<number | null>(null);
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);
  const [addedCode, setAddedCode] = useState<string | null>(null);

  // `/wxycdb` picks this view or the ordinary artist card from the row itself,
  // so an id that is not a shelf row is the wrong screen rather than an error:
  // send it to the card that does describe it. Navigation is a side effect on
  // an external system (the router), which is why it is an effect and not a
  // render-time redirect.
  const misrouted = !!artist && !isVariousArtists(artist.code_letters);
  useEffect(() => {
    if (misrouted) router.replace(`/dashboard/library/artist/${artistId}`);
  }, [misrouted, router, artistId]);

  const genreName = genres?.find((genre) => genre.id === artist?.genre_id)?.genre_name;

  // `fn:trim(format.referenceName)` — the JSP omits blank-named formats rather
  // than offering an unlabelled option.
  const selectableFormats = (formats ?? []).filter(
    (format) => format.format_name.trim() !== "",
  );

  const bucketCode = artist
    ? formatArtistCodeWithPunctuation({
        code_letters: artist.code_letters,
        code_artist_number: artist.code_artist_number,
        genre_id: artist.genre_id,
      })
    : "";

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

    // `artist_id`, never `artist_name`: a name goes through
    // `artistIdFromName(name, genre_id)`, whose fuzzy match would file the
    // release under whichever *other* V/A sub-bucket it landed on — every one
    // of the 53 shares this code, so the collision is the normal case here,
    // not an edge one.
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
      <div data-testid="various-artists-card-error" role="alert" className="artist-error-message">
        This Various Artists section could not be loaded.
      </div>
    );
  }

  if (artistLoading || !artist || misrouted) {
    return <div role="status">Loading…</div>;
  }

  const releases = releasePage?.releases ?? [];
  const total = releasePage?.total ?? 0;
  const isUmbrellaBucket = artistId === UMBRELLA_BUCKET_ARTIST_ID;

  const navigationLinks = (
    <div className="label" style={{ textAlign: "center" }}>
      <Link href="/dashboard/catalog">Do another search</Link>
      &nbsp;&nbsp;&nbsp;&nbsp;
      <Link href="/dashboard/library">Find and Create an Artist and/or Library Code</Link>
      &nbsp;&nbsp;&nbsp;&nbsp;
    </div>
  );

  return (
    <>
      {navigationLinks}

      {/* The post-create confirmation, carried here rather than left on the
          artist card: a compilation code created through the chooser is a V/A
          row, so it routes straight to this screen and would otherwise arrive
          with the servlet's own "has been added to the database" dropped on
          the floor. */}
      {message && (
        <div style={{ textAlign: "center" }} role="status">
          <h5>&nbsp;{message}&nbsp;</h5>
        </div>
      )}
      <div
        className={`validation-message${releaseMessage ? " visible" : ""}`}
        role={releaseMessage ? "alert" : undefined}
      >
        {releaseMessage}
      </div>
      <hr />

      <table cellPadding={5} style={{ margin: "0 auto" }} data-testid="va-bucket-header">
        <tbody>
          <tr>
            <td colSpan={2} style={{ textAlign: "right" }}>
              {artist.alphabetical_name}
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "right" }}>
              <b># of releases:</b>
            </td>
            {/* The server's total, not `releases.length`: the table below is
                paginated, so the row count is a page size. */}
            <td>{total}</td>
          </tr>
        </tbody>
      </table>

      <hr />

      {!isUmbrellaBucket && (
        <>
          <form
            name="addRelease"
            data-testid="va-add-release-form"
            onSubmit={handleAddRelease}
          >
            <table cellPadding={5} style={{ margin: "0 auto" }}>
              <tbody>
                <tr>
                  <td />
                  <td>
                    <b>Add a Library Release for This Section:</b>
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right" }}>
                    <b>Library Code:</b>
                  </td>
                  <td>
                    {genreName ?? ""}&nbsp;{bucketCode}
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
                <tr>
                  <td style={{ textAlign: "right" }}>
                    <b>Album Artist:</b>
                  </td>
                  <td>
                    <span className="label" data-testid="va-album-artist-unavailable">
                      The credited album artist is filled in by the nightly catalog
                      import and cannot be set here yet.
                    </span>
                  </td>
                </tr>
                {/* Not in the JSP — POST /library requires `label`. */}
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
                  <td>{addedCode && <div role="status">Filed as {addedCode}.</div>}</td>
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
        </>
      )}

      {releasesError ? (
        <div
          data-testid="va-release-table-error"
          role="alert"
          className="artist-error-message"
        >
          This section&apos;s releases could not be loaded, so this is not a complete
          list of what is on the shelf.
        </div>
      ) : (
        <table className="entry-table" data-testid="va-release-table">
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
                        // The release's own genre, not the card's. A bucket
                        // crossreferenced in more than one genre reports the
                        // lowest as its card genre, while each release carries
                        // the genre it is actually filed under — and this
                        // string is the call number a librarian walks to the
                        // stacks with, so the word and the id have to come
                        // from the same row.
                        genreName: genres?.find((genre) => genre.id === release.genre_id)
                          ?.genre_name,
                        code_letters: release.code_letters,
                        code_artist_number: release.code_artist_number,
                        genre_id: release.genre_id,
                        code_number: release.code_number,
                        code_volume_letters: release.code_volume_letters,
                      })}
                    </td>
                    <td>
                      <Link href={`/dashboard/library/release/${release.id}`}>
                        {release.album_title}
                      </Link>
                    </td>
                    <td>{release.alternate_artist_name ?? ""}</td>
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

      {/* The endpoint pages, and this is the shelf where paging always bites:
          a compilation bucket is the largest kind of section in the catalog,
          so the table above is truncated as a matter of course while the
          header two rows up prints the server's true total. A librarian who
          scans a silently-cut list and doesn't find the compilation files a
          duplicate — which is the whole failure this screen exists to
          prevent. Same notice the artist card carries, for the same reason. */}
      {total > releases.length && (
        <div className="label" style={{ textAlign: "center" }}>
          Showing the first {releases.length} of {total} releases.
        </div>
      )}

      <hr />

      {navigationLinks}
    </>
  );
}
