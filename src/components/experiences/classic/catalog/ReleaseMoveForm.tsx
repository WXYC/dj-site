"use client";

import { useEffect, useId, useState } from "react";
import {
  useGetFormatsQuery,
  useGetGenresQuery,
  useGetInformationQuery,
  useLazyResolveArtistByCodeQuery,
  useUpdateAlbumMutation,
} from "@/lib/features/catalog/api";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import type { CallLetterMode } from "@/lib/features/catalog/chooserValidation";
import { formatEntireLibraryCode } from "@/lib/features/catalog/libraryCode";
import {
  composeLibraryCodeSearchArgs,
  resolveArtistByCodeErrorReason,
  UNTRUSTWORTHY_CODE_ANSWER_MESSAGE,
} from "@/lib/features/catalog/libraryCodeResolution";
import { formatStationDateTime } from "@/src/utilities/stationTime";
import type { ArtistByCodeOwner } from "@/lib/features/catalog/types";

const CODE_NOT_ASSIGNED_MESSAGE =
  "No artist is filed under that code, so there is nothing to move this release to.";

const NO_DESTINATION_MESSAGE =
  "Look up a library code first — a move needs a destination.";

const AMBIGUOUS_DESTINATION_MESSAGE =
  "More than one artist owns that code. Choose which one this release belongs to.";

const SAME_CODE_MESSAGE = "This release is already filed under that code.";

/**
 * "Move to a Different Library Code" — reproducing
 * `libraryAdmin/libraryReleaseModifyLibCode.jsp`, reached from the release
 * editor's "Change the Library Code of This Library Release".
 *
 * The JSP's row set is its own, not the editor's: it drops Album Artist and
 * Library Status and inserts a Library Code control in third position. That is
 * reproduced here rather than factored into a shared row component with the
 * editor — the two screens genuinely disagree about which rows they carry, and
 * a component parameterised enough to serve both would cost more than the
 * duplication it removes.
 *
 * Divergences from the JSP:
 *
 *  - **The destination is looked up by code, not chosen from a list of every
 *    artist.** The JSP renders `allArtists` into one `<select>`. There is no
 *    all-artists endpoint to back that, and at the catalog's size the control
 *    would be unusable even if there were. `GET /library/artists/by-code`
 *    answers the question the select was really for — "who holds this code?" —
 *    and answers it better on the case that matters: a compilation code is
 *    held by many artists at once, which a scrolling select cannot
 *    disambiguate but the owner list below can. Composition of the triple is
 *    left to `composeLibraryCodeSearchArgs`, the same owner the chooser uses.
 *  - **Release Call Number and Release Call Letter are read-only**, as on the
 *    editor: `PATCH /library/:id` accepts neither. The call number is also not
 *    the librarian's to set here — Backend keeps it across the move unless the
 *    destination artist already owns that number, in which case it burns the
 *    next one in that artist's sequence. The screen says so rather than
 *    implying the number on it survives.
 *  - **"Time Last Modified" is "Date Added"**, for the reason the editor
 *    documents: the published contract does not carry a last-modified value.
 *  - **Cross-reference blocks and "Add Xrefs" omitted.** Write-side
 *    cross-reference admin is frozen.
 *
 * The move sends `genre_id` alongside `artist_id`, always. Backend validates
 * the *effective* pair — `artist_id ?? existing.artist_id` against
 * `genre_id ?? existing.genre_id` — so a move to an artist in another genre,
 * sent as `artist_id` alone, is rejected as "Artist is not catalogued in the
 * selected genre". The destination genre is known here for free: it is the
 * genre the code was looked up in.
 */
export default function ReleaseMoveForm({ albumId }: { albumId: number }) {
  const genreFieldId = useId();
  const lettersId = useId();
  const numbersId = useId();

  const { data, isLoading, isError } = useGetInformationQuery({ album_id: albumId });
  const { data: genres } = useGetGenresQuery();
  const { data: formats } = useGetFormatsQuery();
  const [resolveArtistByCode, { isFetching: isResolving }] = useLazyResolveArtistByCodeQuery();
  const [updateAlbum, { isLoading: saving }] = useUpdateAlbumMutation();

  const [genreId, setGenreId] = useState<number | null>(null);
  const [callLetterMode, setCallLetterMode] = useState<CallLetterMode>(null);
  const [codeLetters, setCodeLetters] = useState("");
  const [codeNumbers, setCodeNumbers] = useState("");

  /** The owners of the looked-up code, and which one the move is aimed at. */
  const [owners, setOwners] = useState<ArtistByCodeOwner[] | null>(null);
  const [destinationGenreId, setDestinationGenreId] = useState<number | null>(null);
  const [chosenOwnerId, setChosenOwnerId] = useState<number | null>(null);

  /**
   * Retires a resolved destination the moment the code on screen stops naming
   * it. Without this, editing the genre or the call letters after a lookup
   * leaves the previous artist armed behind a code the librarian has already
   * replaced — and the submit files the release under an artist that is no
   * longer anywhere on the screen, then names them in the confirmation.
   */
  const forgetDestination = () => {
    setOwners(null);
    setChosenOwnerId(null);
    setDestinationGenreId(null);
    setMessage("");
  };

  const [title, setTitle] = useState("");
  const [altArtist, setAltArtist] = useState("");
  const [formatId, setFormatId] = useState<number | "">("");
  const [message, setMessage] = useState("");

  // Mirrors server state until the librarian edits it, exactly as the editor
  // does — the JSP ships this screen with the same fields pre-filled.
  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setAltArtist(data.alternate_artist ?? "");
    setFormatId(data.format_id ?? "");
  }, [data]);

  // The JSP's genre select carries no empty option, so a genre is always
  // chosen; the list here is fetched, so derive one as soon as it lands.
  const effectiveGenreId = genreId ?? genres?.[0]?.id ?? null;

  if (isLoading) {
    return (
      <div className="label" style={{ textAlign: "center" }}>
        Loading the release...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div data-testid="release-move-error" role="alert" className="artist-error-message">
        This release could not be loaded, so it cannot be moved.
      </div>
    );
  }

  const entireLibraryCode = formatEntireLibraryCode({
    genreName: data.artist.genre,
    code_letters: data.artist.lettercode,
    code_artist_number: data.artist.numbercode,
    genre_id: data.genre_id ?? 0,
    code_number: data.entry,
    code_volume_letters: null,
  });

  const currentArtistId = data.artist.id;
  const added = data.add_date ? formatStationDateTime(data.add_date) : undefined;
  const destination =
    owners && owners.length === 1
      ? owners[0]
      : (owners?.find((candidate) => candidate.id === chosenOwnerId) ?? null);

  const handleLookUp = async () => {
    forgetDestination();

    const composed = composeLibraryCodeSearchArgs({
      callLetterMode,
      artistLettersTextbox: codeLetters,
      artistNumbersTextbox: codeNumbers,
      genreId: effectiveGenreId,
    });
    if (!composed.ready) {
      setMessage(composed.message);
      return;
    }

    let found: ArtistByCodeOwner[];
    try {
      found = (await resolveArtistByCode(composed.args).unwrap()).artists;
    } catch (err) {
      const reason = resolveArtistByCodeErrorReason(err);
      if (reason === "code_not_assigned") {
        setMessage(CODE_NOT_ASSIGNED_MESSAGE);
        return;
      }
      if (reason === "genre_not_found") {
        setMessage(
          `No genre in the catalog has id ${composed.args.genre_id}, so this code can't be looked up.`,
        );
        return;
      }
      setMessage(UNTRUSTWORTHY_CODE_ANSWER_MESSAGE);
      return;
    }

    // A 200 with no owners is a shape the endpoint's contract never produces:
    // an unassigned code is a 404. Reaching here means the answer cannot be
    // trusted, and trusting it would offer a move to nobody.
    if (found.length === 0) {
      setMessage(UNTRUSTWORTHY_CODE_ANSWER_MESSAGE);
      return;
    }

    setOwners(found);
    setDestinationGenreId(composed.args.genre_id);
    if (found.length > 1) {
      setMessage(AMBIGUOUS_DESTINATION_MESSAGE);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!owners) {
      setMessage(NO_DESTINATION_MESSAGE);
      return;
    }
    if (!destination || destinationGenreId === null) {
      setMessage(AMBIGUOUS_DESTINATION_MESSAGE);
      return;
    }
    // `currentArtistId` is undefined for a row that carries no `artist_id`,
    // and `id === undefined` is false for every destination — so comparing
    // ids alone would let a no-op move through and report it as a real one.
    // The looked-up code is the fallback discriminant: it is what the
    // librarian actually typed, and it identifies the shelf position whether
    // or not the row names an artist.
    const alreadyThere =
      currentArtistId != null
        ? destination.id === currentArtistId
        : destination.code_letters === data.artist.lettercode &&
          destination.code_number === data.artist.numbercode;
    if (alreadyThere) {
      setMessage(SAME_CODE_MESSAGE);
      return;
    }
    if (!title.trim()) {
      setMessage("Please enter a title for this release.");
      return;
    }

    try {
      await updateAlbum({
        albumId,
        body: {
          artist_id: destination.id,
          // Never omitted: see this component's doc for what the endpoint does
          // with a genre it was not told about.
          genre_id: destinationGenreId,
          album_title: title.trim(),
          alternate_artist_name: altArtist.trim() === "" ? null : altArtist.trim(),
          ...(formatId === "" ? {} : { format_id: Number(formatId) }),
        },
      }).unwrap();
      setMessage(
        `This library release has been moved to ${destination.artist_name}. Its call number may have changed, since the destination may already have been using this one.`,
      );
    } catch {
      setMessage("This library release could not be moved.");
    }
  };

  return (
    <div id="releaseMoveCard">
      <div className="label" style={{ textAlign: "center" }}>
        <a href="/dashboard/catalog">Do another search</a>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <a href="/dashboard/library">Find and Create an Artist and/or Library Code</a>
        <p />
        <a href={`/dashboard/library/release/${albumId}`}>
          View/Modify/Delete this Library Release
        </a>
      </div>

      <div style={{ textAlign: "center" }}>
        <h3>
          LIBRARY RELEASE: &nbsp;{entireLibraryCode}&nbsp;-&nbsp;{data.artist.name} - {data.title}
        </h3>
      </div>

      <div style={{ textAlign: "center" }}>
        <h3 data-testid="release-move-message" role="status">
          &nbsp;{message}&nbsp;
        </h3>
      </div>

      <form name="modifyRelease" onSubmit={handleSubmit}>
        <table cellPadding={5}>
          <tbody>
            <tr>
              <td></td>
              <td>
                <h3>View/Modify a Library Release</h3>
              </td>
            </tr>
            <tr>
              <th scope="row" style={{ textAlign: "right" }}>
                <b>Entire Code For Library Release:</b>
              </th>
              <td data-testid="release-move-current-code">{entireLibraryCode}</td>
            </tr>
            <tr>
              <th scope="row" style={{ textAlign: "right" }}>
                <b>Artist:</b>
              </th>
              <td>
                {currentArtistId != null ? (
                  <a
                    href={artistCardHref({
                      id: currentArtistId,
                      code_letters: data.artist.lettercode,
                    })}
                  >
                    {data.artist.name}
                  </a>
                ) : (
                  data.artist.name
                )}
              </td>
            </tr>
            <tr>
              <th scope="row" style={{ textAlign: "right" }}>
                <b>Library Code:</b>
              </th>
              <td>
                <label htmlFor={genreFieldId}>Genre:</label>{" "}
                <select
                  id={genreFieldId}
                  value={effectiveGenreId ?? ""}
                  disabled={!genres || genres.length === 0}
                  onChange={(event) => {
                    setGenreId(event.target.value ? Number(event.target.value) : null);
                    forgetDestination();
                  }}
                >
                  {(genres ?? []).map((genre) => (
                    <option key={genre.id} value={genre.id}>
                      {genre.genre_name}
                    </option>
                  ))}
                </select>
                <br />
                <input
                  type="radio"
                  name="callLetterMode"
                  value="textbox"
                  checked={callLetterMode === "textbox"}
                  onChange={() => {
                    setCallLetterMode("textbox");
                    forgetDestination();
                  }}
                  aria-label="Call letters: mode"
                />
                <label htmlFor={lettersId}>Call letters:</label>
                <input
                  id={lettersId}
                  type="text"
                  value={codeLetters}
                  disabled={callLetterMode !== "textbox"}
                  onChange={(event) => {
                    setCodeLetters(event.target.value);
                    forgetDestination();
                  }}
                  size={3}
                  maxLength={3}
                />
                &nbsp;
                <label htmlFor={numbersId}>Call Numbers:</label>
                <input
                  id={numbersId}
                  type="text"
                  value={codeNumbers}
                  disabled={callLetterMode !== "textbox"}
                  onChange={(event) => {
                    setCodeNumbers(event.target.value);
                    forgetDestination();
                  }}
                  size={3}
                  maxLength={3}
                />
                <br />
                <input
                  type="radio"
                  name="callLetterMode"
                  value="compilation"
                  checked={callLetterMode === "compilation"}
                  onChange={() => {
                    setCallLetterMode("compilation");
                    forgetDestination();
                  }}
                  aria-label="Various Artists (compilations)"
                />
                Various Artists (compilations)
                <br />
                <button type="button" onClick={handleLookUp} disabled={isResolving}>
                  Look up this code
                </button>
                {destination ? (
                  <div data-testid="release-move-destination">
                    Moving to: <b>{destination.artist_name}</b>
                  </div>
                ) : null}
                {owners && owners.length > 1 ? (
                  <div data-testid="release-move-owners">
                    {owners.map((candidate) => (
                      <div key={candidate.id}>
                        <label>
                          <input
                            type="radio"
                            name="destinationOwner"
                            checked={chosenOwnerId === candidate.id}
                            onChange={() => setChosenOwnerId(candidate.id)}
                          />
                          {candidate.artist_name}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : null}
              </td>
            </tr>
            <tr>
              <th scope="row" style={{ textAlign: "right" }}>
                <b>Release Call Number:</b>
              </th>
              <td data-testid="release-move-call-number">{data.entry}</td>
            </tr>
            <tr>
              <th scope="row" style={{ textAlign: "right" }}>
                <b>Release Call Letter:</b>
              </th>
              {/* `/library/info` does not project the volume letter, so this is
                  blank rather than wrong — the editor documents the same gap. */}
              <td data-testid="release-move-call-letter"></td>
            </tr>
            <tr>
              <th scope="row" style={{ textAlign: "right" }}>
                <b>Alternate Artist Name:</b>
              </th>
              <td>
                <input
                  type="text"
                  name="altArtistName"
                  size={35}
                  aria-label="Alternate Artist Name"
                  value={altArtist}
                  onChange={(event) => setAltArtist(event.target.value)}
                />
              </td>
            </tr>
            <tr>
              <th scope="row" style={{ textAlign: "right" }}>
                <b>Title of Release:</b>
              </th>
              <td>
                <input
                  type="text"
                  name="title"
                  size={60}
                  aria-label="Title of Release"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </td>
            </tr>
            <tr>
              <th scope="row" style={{ textAlign: "right" }}>
                <b>Format:</b>
              </th>
              <td>
                <select
                  name="formatID"
                  aria-label="Format"
                  value={formatId}
                  onChange={(event) =>
                    setFormatId(event.target.value === "" ? "" : Number(event.target.value))
                  }
                >
                  {(formats ?? []).map((format) => (
                    <option key={format.id} value={format.id}>
                      {format.format_name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            <tr>
              <th scope="row" style={{ textAlign: "right" }}>
                <b>Date Added:</b>
              </th>
              <td>{added ? `${added.time} ${added.day}` : ""}</td>
            </tr>
            <tr>
              <td></td>
              <td>
                <input type="submit" value="Modify this Library Release" disabled={saving} />
                &nbsp;&nbsp;
                <a href={`/dashboard/library/release/${albumId}/delete`}>
                  Delete This Library Release
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </div>
  );
}
