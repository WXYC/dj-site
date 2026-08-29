"use client";

import { useEffect, useState } from "react";
import {
  useGetFormatsQuery,
  useGetInformationQuery,
  useMarkFoundMutation,
  useMarkMissingMutation,
  useUpdateAlbumMutation,
} from "@/lib/features/catalog/api";
import { formatEntireLibraryCode, isVariousArtists } from "@/lib/features/catalog/libraryCode";
import { formatStationDateTime } from "@/src/utilities/stationTime";
import Tracklist from "./Tracklist";

/**
 * "View/Modify a Library Release" — the screen a catalog result's release title
 * opens, reproducing `libraryAdmin/libraryReleaseModify.jsp`.
 *
 * Divergences, each forced by what Backend-Service serves rather than chosen:
 *
 *  - **Release Call Number and Release Call Letter are read-only.** The JSP
 *    edits both. `PATCH /library/:id` accepts neither, so rendering them as
 *    inputs would offer an edit that silently discards.
 *  - **Album Artist is read-only**, for the same reason: not in the PATCH body.
 *    The published `AddAlbumRequest` schema does declare the field, but no
 *    Backend write path reads it on either verb, so an input here would
 *    discard silently.
 *  - **"Delete This Library Release" is offered unconditionally.** The JSP
 *    suppresses it when the release has cross-references. Backend refuses on a
 *    stronger and more relevant criterion — flowsheet plays, which the JSP
 *    deleted straight through — and refuses server-side, where the answer
 *    cannot go stale between the check and the click. The confirmation screen
 *    states that refusal; see `ReleaseDeleteConfirm`.
 *  - **No "Undo Last Change"** — nothing stands behind it. The JSP's two links
 *    to the move screen are both reproduced, under both of its wordings.
 *  - **Cross-reference blocks and "Add Xrefs" omitted.** Write-side
 *    cross-reference admin is frozen; read-only display is owned separately,
 *    for this screen and the artist card together.
 *  - **The Artist cell is text, not a link.** The JSP links it to a card with
 *    no role gate; ours is gated, so the link lands when the ungated view card
 *    does.
 *  - **"Time Last Modified" is replaced by "Date Added".** Backend returns
 *    `last_modified`, but the published contract does not declare it and the
 *    conversion to the client row therefore drops it. Reading it anyway would
 *    mean an untyped cast — the pattern that turns a contract gap into a
 *    silent `undefined` — and printing the add date under the JSP's label
 *    would be worse than printing it under a true one.
 *
 * One addition beyond the JSP, not a divergence from it: a Various Artists
 * release gets a link to `ReleaseTracklistEditor`, right above the read-only
 * `Tracklist` this screen already renders. No JSP offers this — the legacy
 * tracklist is display-only — so there is nothing here to diverge from; see
 * that component for why classic needs a write path for per-track credits at
 * all.
 *
 * That link and the tracklist below it must agree on what a compilation is, or
 * a credit is enterable through the one and unreadable in the other. Both use
 * `isVariousArtists(artist.lettercode)` — never `album_artist`, which the
 * nightly catalog import alone writes and which is therefore absent on a
 * release filed today.
 */
export default function ReleaseCard({ albumId }: { albumId: number }) {
  const { data, isLoading, isError } = useGetInformationQuery({ album_id: albumId });
  const { data: formats } = useGetFormatsQuery();
  const [updateAlbum, { isLoading: saving }] = useUpdateAlbumMutation();
  const [markMissing, { isLoading: markingMissing }] = useMarkMissingMutation();
  const [markFound, { isLoading: markingFound }] = useMarkFoundMutation();

  const [title, setTitle] = useState("");
  const [altArtist, setAltArtist] = useState("");
  const [formatId, setFormatId] = useState<number | "">("");
  const [message, setMessage] = useState("");

  // The form mirrors server state until the librarian edits it; re-syncing on a
  // new row is the only reason this effect exists.
  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setAltArtist(data.alternate_artist ?? "");
    setFormatId(data.format_id ?? "");
  }, [data]);

  if (isLoading) {
    return (
      <div className="label" style={{ textAlign: "center" }}>
        Loading the release...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div data-testid="release-card-error" role="alert" className="artist-error-message">
        This release could not be loaded.
      </div>
    );
  }

  // `code_volume_letters` is null rather than omitted: `GET /library/info` does
  // not project it, so a multi-volume release shows `5` where the artist card's
  // release table shows `5-A`. `genre_id` falls back to 0, which is not the
  // Soundtracks id, so an absent genre takes the ordinary V/A branch.
  const entireLibraryCode = formatEntireLibraryCode({
    genreName: data.artist.genre,
    code_letters: data.artist.lettercode,
    code_artist_number: data.artist.numbercode,
    genre_id: data.genre_id ?? 0,
    code_number: data.entry,
    code_volume_letters: null,
  });

  const displayArtist = data.album_artist ? "Various Artists" : data.artist.name;
  const artistCode = `${data.artist.lettercode} ${data.artist.numbercode}`;
  const missing = !!data.date_lost && !data.date_found;
  const added = data.add_date ? formatStationDateTime(data.add_date) : undefined;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setMessage("Please enter a title for this release.");
      return;
    }
    try {
      await updateAlbum({
        albumId,
        body: {
          album_title: title.trim(),
          alternate_artist_name: altArtist.trim() === "" ? null : altArtist.trim(),
          ...(formatId === "" ? {} : { format_id: Number(formatId) }),
        },
      }).unwrap();
      setMessage("This library release has been modified.");
    } catch {
      setMessage("This library release could not be modified.");
    }
  };

  const toggleMissing = async () => {
    try {
      if (missing) {
        await markFound({ albumId }).unwrap();
        setMessage("This library release has been marked as found.");
      } else {
        await markMissing({ albumId }).unwrap();
        setMessage("This library release has been marked as missing.");
      }
    } catch {
      setMessage("The library status could not be changed.");
    }
  };

  return (
    <div id="releaseCard">
      <div className="label" style={{ textAlign: "center" }}>
        <a href="/dashboard/catalog">Do another search</a>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <a href="/dashboard/library">Find and Create an Artist and/or Library Code</a>
        <p />
        <a href={`/dashboard/library/release/${albumId}/move`}>
          Change the Library Code of This Library Release
        </a>
      </div>

      <div style={{ textAlign: "center" }}>
        <h3>
          LIBRARY RELEASE: &nbsp;{entireLibraryCode}&nbsp;-&nbsp;{displayArtist} - {data.title}
        </h3>
      </div>

      <div style={{ textAlign: "center" }}>
        <h3 data-testid="release-message">&nbsp;{message}&nbsp;</h3>
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
              <td style={{ textAlign: "right" }}>
                <b>Entire Code For Library Release:</b>
              </td>
              <td data-testid="release-library-code">{entireLibraryCode}</td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Artist:</b>
              </td>
              <td>
                {artistCode} - {displayArtist}
                &nbsp;&nbsp;&nbsp;
                <a href={`/dashboard/library/release/${albumId}/move`}>
                  Change the Artist Code of This Library Release
                </a>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Release Call Number:</b>
              </td>
              <td data-testid="release-call-number">{data.entry}</td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Album Artist:</b>
              </td>
              <td>{data.album_artist ?? ""}</td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Alternate Artist Name:</b>
              </td>
              <td>
                <input
                  type="text"
                  name="altArtistName"
                  size={50}
                  aria-label="Alternate Artist Name"
                  value={altArtist}
                  onChange={(event) => setAltArtist(event.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Title of Release:</b>
              </td>
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
              <td style={{ textAlign: "right" }}>
                <b>Format:</b>
              </td>
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
              <td style={{ textAlign: "right" }}>
                <b>Date Added:</b>
              </td>
              <td>{added ? `${added.time} ${added.day}` : ""}</td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Library Status:</b>
              </td>
              <td data-testid="release-library-status">
                {missing ? (
                  <span style={{ color: "red", fontWeight: "bold" }}>
                    Missing since {formatStationDateTime(data.date_lost as string).day}
                  </span>
                ) : (
                  "In Library"
                )}
                &nbsp;&nbsp;
                <button
                  type="button"
                  className="label"
                  onClick={toggleMissing}
                  disabled={markingMissing || markingFound}
                >
                  {missing ? "Mark as Found" : "Mark as Missing"}
                </button>
              </td>
            </tr>
            <tr>
              <td></td>
              <td>
                <input
                  type="submit"
                  value="Modify this Library Release"
                  disabled={saving}
                />
                &nbsp;&nbsp;
                <a href={`/dashboard/library/release/${albumId}/delete`}>
                  Delete This Library Release
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </form>

      {isVariousArtists(data.artist.lettercode) && (
        <div className="label" style={{ textAlign: "center" }}>
          <a href={`/dashboard/library/release/${albumId}/tracklist`}>
            Enter Per-Track Artist Credits
          </a>
        </div>
      )}

      <Tracklist
        albumId={albumId}
        legacyReleaseId={data.legacy_release_id}
        variousArtists={isVariousArtists(data.artist.lettercode)}
      />
    </div>
  );
}
