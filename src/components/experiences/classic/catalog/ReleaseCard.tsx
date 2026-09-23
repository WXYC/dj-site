"use client";

import { useEffect, useRef, useState } from "react";
import {
  useGetFormatsQuery,
  useGetInformationQuery,
  useMarkFoundMutation,
  useMarkMissingMutation,
  useUpdateAlbumMutation,
} from "@/lib/features/catalog/api";
import {
  normalizeCodeLetters,
  parseReleaseCodeNumber,
  RELEASE_CODE_NUMBER_OUT_OF_RANGE_MESSAGE,
  releaseVolumeLettersTooLong,
  RELEASE_VOLUME_LETTERS_TOO_LONG_MESSAGE,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { formatEntireLibraryCode, isVariousArtists } from "@/lib/features/catalog/libraryCode";
import { formatStationDateTime } from "@/src/utilities/stationTime";
import Tracklist from "./Tracklist";

/**
 * "View/Modify a Library Release" — the screen a catalog result's release title
 * opens, reproducing `libraryAdmin/libraryReleaseModify.jsp`.
 *
 * Divergences, each forced by what Backend-Service serves rather than chosen:
 *
 *  - **Release Call Number and Release Call Letter are editable**, matching
 *    the JSP. `PATCH /library/:id` accepts both, with no artist-scoped
 *    collision check -- the same single-librarian decision `POST /library`
 *    already makes, and there is still no DB uniqueness constraint on
 *    `code_number`, so an operator-chosen number another release already
 *    holds is written verbatim rather than refused. Which numbers the
 *    destination artist already holds is not shown here either; the artist
 *    card's release table and its next-number preview are where the shelf is
 *    legible.
 *
 *    Both inputs show the stored value -- the letter included, since two
 *    releases sharing one call number are told apart by that half alone -- and
 *    both are sent only when what is on screen differs from it, so a title fix
 *    is not also a shelf-slot write. An emptied call-letter field sends an
 *    explicit `null` rather than omitting the key: omission means "leave the
 *    stored value alone" under partial-update semantics, and this is the only
 *    screen that can set these letters at all, so without the explicit null it
 *    could set them and never take them back off.
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
 *  - **The submit reads "Save", and stays disabled until a field changes.**
 *    The JSP's "Modify this Library Release" posts whatever is on screen, so
 *    an idle submit re-sends the row unchanged. The write is a full-field
 *    update, which makes that a no-op indistinguishable from a real save --
 *    same message, same everything. Gating the button on a real edit makes it
 *    report whether the screen holds unsaved work.
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
 * `isVariousArtists(artist.lettercode)` — never `album_artist`. Since BS#2004
 * that column is an ordinary librarian-written credit, present on any release
 * someone chose to record one for, so its presence says nothing about which
 * shelf the release is on.
 */
export default function ReleaseCard({ albumId }: { albumId: number }) {
  const { data, isLoading, isError } = useGetInformationQuery({ album_id: albumId });
  const { data: formats } = useGetFormatsQuery();
  const [updateAlbum, { isLoading: saving }] = useUpdateAlbumMutation();
  const [markMissing, { isLoading: markingMissing }] = useMarkMissingMutation();
  const [markFound, { isLoading: markingFound }] = useMarkFoundMutation();

  const [title, setTitle] = useState("");
  const [altArtist, setAltArtist] = useState("");
  const [albumArtist, setAlbumArtist] = useState("");
  const [formatId, setFormatId] = useState<number | "">("");
  const [codeNumber, setCodeNumber] = useState("");
  const [volumeLetters, setVolumeLetters] = useState("");
  const [message, setMessage] = useState("");

  // The form mirrors server state until the librarian edits it; seeding a newly
  // loaded row is the only reason this effect exists.
  //
  // Keyed on the release rather than on the `data` reference, because this
  // screen triggers its own refetches: Mark as Missing / Mark as Found
  // invalidate the very detail read the form is seeded from, and the refetch
  // builds a fresh object. Re-seeding on that would overwrite a field the
  // librarian is part-way through typing, with a message line reporting only
  // the status change -- and the call letter is the least recoverable of them,
  // since blank is that field's resting state, so a wiped edit is
  // indistinguishable from an untouched field.
  const seededRelease = useRef<number | null>(null);
  useEffect(() => {
    if (!data || seededRelease.current === albumId) return;
    seededRelease.current = albumId;
    setTitle(data.title);
    setAltArtist(data.alternate_artist ?? "");
    setAlbumArtist(data.album_artist ?? "");
    setFormatId(data.format_id ?? "");
    setCodeNumber(String(data.entry));
    setVolumeLetters(data.code_volume_letters ?? "");
  }, [data, albumId]);

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

  // Composed from what is stored, not from what the call-code inputs currently
  // hold: this is the code the release is filed under until a save lands, and a
  // header tracking the inputs would report a shelf slot nothing is on.
  // `genre_id` falls back to 0, which is not the Soundtracks id, so an absent
  // genre takes the ordinary V/A branch.
  const entireLibraryCode = formatEntireLibraryCode({
    genreName: data.artist.genre,
    code_letters: data.artist.lettercode,
    code_artist_number: data.artist.numbercode,
    genre_id: data.genre_id ?? 0,
    code_number: data.entry,
    code_volume_letters: data.code_volume_letters ?? null,
  });

  // Decided by the shelf, not by the credit -- see the component docblock.
  const displayArtist = isVariousArtists(data.artist.lettercode) ? "Various Artists" : data.artist.name;
  const artistCode = `${data.artist.lettercode} ${data.artist.numbercode}`;
  const missing = !!data.date_lost && !data.date_found;
  const added = data.add_date ? formatStationDateTime(data.add_date) : undefined;

  // One normalization, read by both the write and the pristine check below, so
  // the button cannot come to disagree with what submitting would send.
  const editedTitle = title.trim();
  const editedAltArtist = altArtist.trim() === "" ? null : altArtist.trim();
  const editedAlbumArtist = albumArtist.trim() === "" ? null : albumArtist.trim();
  const editedFormatId = formatId === "" ? null : Number(formatId);
  const editedCodeNumber = codeNumber.trim();
  // Both sides folded to the casing this input files in, so re-typing the
  // stored letters in the other case is not an edit. Nothing downstream can
  // tell the two apart either: every reader of the column folds case, and the
  // input itself normalizes as the librarian types.
  const editedVolumeLetters = normalizeCodeLetters(volumeLetters.trim());
  const storedVolumeLetters = normalizeCodeLetters((data.code_volume_letters ?? "").trim());
  // The call number compares as typed rather than as a number: the shared
  // parser accepts only canonical no-leading-zero decimals, so any value it
  // would accept that differs as a string differs as a number too.
  const codeNumberChanged = editedCodeNumber !== String(data.entry);
  const volumeLettersChanged = editedVolumeLetters !== storedVolumeLetters;

  // Compared against the trimmed payload rather than the raw fields: the write
  // trims, so a stray space is not an edit, and treating it as one would let
  // Save post a body identical to the row it already holds.
  const storedAltArtist = (data.alternate_artist ?? "").trim();
  const storedAlbumArtist = (data.album_artist ?? "").trim();
  const dirty =
    editedTitle !== (data.title ?? "").trim() ||
    editedAltArtist !== (storedAltArtist === "" ? null : storedAltArtist) ||
    editedAlbumArtist !== (storedAlbumArtist === "" ? null : storedAlbumArtist) ||
    editedFormatId !== (data.format_id ?? null) ||
    codeNumberChanged ||
    volumeLettersChanged;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editedTitle) {
      setMessage("Please enter a title for this release.");
      return;
    }
    // Parsed only when the field was touched. Restating the stored number on
    // every save would put a shelf write behind a title fix, and it would also
    // let a stored number this form cannot express -- a legacy 0, which the
    // shared parser refuses as a call number -- block the title, alternate
    // artist and format along with it.
    let parsedCodeNumber: number | undefined;
    if (codeNumberChanged) {
      const parsed = parseReleaseCodeNumber(editedCodeNumber);
      if (parsed === null) {
        setMessage(RELEASE_CODE_NUMBER_OUT_OF_RANGE_MESSAGE);
        return;
      }
      parsedCodeNumber = parsed;
    }
    if (volumeLettersChanged && releaseVolumeLettersTooLong(editedVolumeLetters)) {
      setMessage(RELEASE_VOLUME_LETTERS_TOO_LONG_MESSAGE);
      return;
    }
    try {
      await updateAlbum({
        albumId,
        body: {
          album_title: editedTitle,
          alternate_artist_name: editedAltArtist,
          // BS#2004: same wire shape as the alternate name -- always sent,
          // null when blank, so an emptied field clears the stored credit.
          album_artist: editedAlbumArtist,
          // Omitted rather than sent as null when unset -- the wire shape the
          // endpoint has always received from this screen.
          ...(editedFormatId === null ? {} : { format_id: editedFormatId }),
          ...(parsedCodeNumber === undefined ? {} : { code_number: parsedCodeNumber }),
          // An emptied field sends an explicit null, which is what clears the
          // column: omitting the key leaves whatever is stored, and this screen
          // is the only one that can put letters on a release, so omitting a
          // cleared field would make a mistyped letter permanent.
          ...(volumeLettersChanged
            ? {
                code_volume_letters:
                  editedVolumeLetters === "" ? null : editedVolumeLetters,
              }
            : {}),
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
              <td>
                <input
                  type="text"
                  size={6}
                  inputMode="numeric"
                  aria-label="Release Call Number"
                  data-testid="release-call-number"
                  value={codeNumber}
                  onChange={(event) => setCodeNumber(event.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Release Call Letter:</b>
              </td>
              <td>
                <input
                  type="text"
                  size={4}
                  aria-label="Release Call Letter"
                  data-testid="release-call-letter"
                  value={volumeLetters}
                  onChange={(event) => setVolumeLetters(normalizeCodeLetters(event.target.value))}
                />
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "right" }}>
                <b>Album Artist:</b>
              </td>
              <td>
                <input
                  type="text"
                  name="albumArtist"
                  size={50}
                  aria-label="Album Artist"
                  value={albumArtist}
                  onChange={(event) => setAlbumArtist(event.target.value)}
                />
              </td>
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
                <input type="submit" value="Save" disabled={saving || !dirty} />
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
