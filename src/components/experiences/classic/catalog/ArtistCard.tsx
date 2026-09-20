"use client";

import { skipToken } from "@reduxjs/toolkit/query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  useAddAlbumMutation,
  useGetArtistCardQuery,
  useGetArtistReleasesQuery,
  useGetFormatsQuery,
  useGetGenresQuery,
  useGetNextReleaseNumberQuery,
  useUpdateArtistCardMutation,
} from "@/lib/features/catalog/api";
import {
  ARTIST_NAME_MAX_LENGTH,
  artistNameTooLong,
  isAddArtistConflict,
  normalizeCodeLetters,
  resolveReleaseCodeFields,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { validateNewArtistNames } from "@/lib/features/catalog/chooserValidation";
import {
  formatArtistCodeWithPunctuation,
  formatEntireLibraryCode,
  isVariousArtists,
} from "@/lib/features/catalog/libraryCode";
import type { AddAlbumRequestBody, ArtistRelease } from "@/lib/features/catalog/types";
import {
  importedConfirmation,
  type ImportedReleaseParams,
} from "@/lib/features/rotation/importedConfirmation";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
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
  /**
   * Where a rotation import landed, when this card is an import's landing.
   * The sentence is composed here rather than carried as text because only
   * this card holds the artist half of the shelf code.
   */
  imported?: ImportedReleaseParams;
};

/** `artist-card-modify.js` `validateAddRelease`, verbatim. */
const EMPTY_TITLE_MESSAGE = "Please enter a title before adding this release.";

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
 * - **Three of `modifyArtist`'s five fields are read-only.** `PATCH
 *   /library/artists/:id` allowlists `alphabetical_name` and `artist_name`
 *   and *rejects* `genre_id`, `code_letters`, and `code_artist_number` with a
 *   400 naming why. Rendering them as editable inputs would offer an edit
 *   that always fails. Those three have no write path anywhere in
 *   Backend-Service.
 * - **The genre renders as text, not the JSP's `<select>`.** Same cause: with
 *   no write path, a dropdown would be a control that cannot commit.
 * - **No "Time Last Modified" row for the artist.** `GET /library/artists/:id`
 *   does not project one. Rendering a blank labelled row would read as "never
 *   modified", which is a claim, so the row is dropped instead.
 * - **No "Delete The Artist" link.** The JSP offers it only for an artist with
 *   no releases and no cross-references; Backend-Service has no delete-artist
 *   endpoint at any privilege (`DELETE /library/:id` deletes a *release*).
 * - **The add-release form's release call number and volume letters are
 *   editable, not derived.** `POST /library` accepts an operator-chosen
 *   `code_number` and `code_volume_letters`. An empty
 *   call-number field yields the server's own MAX+1 assignment; an empty
 *   volume-letters field yields NULL -- there is no generator for that
 *   column, unlike `code_number`. Either way the assigned code is reported
 *   back after the save, which is the fact the librarian actually needs --
 *   it is what goes on the sleeve.
 * - **The add-release form gains a Label field.** `POST /library` requires
 *   `label`; the JSP's form has no such input. Same precedent as
 *   `NewArtistForm` adding genre and call letters/numbers because
 *   `POST /library/artists` requires them.
 * - **The cross-reference blocks (`:157-232`) and the "Add Xrefs" links are
 *   absent.** Write-side cross-reference admin is deliberately not being
 *   rebuilt, and the read-only display is a separate, non-blocking screen.
 * - **No sortable column headers.** The JSP's `SortHeaderController` posts a
 *   sort back to the servlet; `GET /library/artists/:id/releases` takes no
 *   sort parameter and returns shelf order, which is the order the JSP itself
 *   defaults to.
 */
export default function ArtistCard({ artistId, message, imported }: ArtistCardProps) {
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
  // The peek is genre-scoped, and `artist.genre_id` is only known once the
  // card query resolves. `skipToken` rather than a placeholder genre plus
  // `{ skip }`: a fabricated `genre_id` would be a real value in the arg, and
  // the one state a `!artist` guard does NOT block is a resolved card whose
  // body omitted `genre_id` -- these types are hand-maintained with no codegen
  // gate, so a projection change upstream makes that reachable without any
  // parse error. Because this query soft-fails, such a request degrades to
  // "the field never prefills" rather than surfacing, which is exactly the
  // silent symptom the genre parameter exists to prevent. Keying on the genre
  // itself makes the invalid arg unrepresentable instead of merely guarded --
  // the same `arg ?? skipToken` shape as `useArtistCodePeek` and
  // `useCompilationBucketResolution`.
  const nextReleaseArg =
    artist?.genre_id != null ? { artistId, genre_id: artist.genre_id } : skipToken;
  const {
    data: nextRelease,
    isFetching: nextReleaseFetching,
    isUninitialized: nextReleaseUninitialized,
  } = useGetNextReleaseNumberQuery(nextReleaseArg);
  const { data: genres } = useGetGenresQuery();
  const { data: formats } = useGetFormatsQuery();

  const [updateArtist, { isLoading: savingArtist }] = useUpdateArtistCardMutation();
  const [addAlbum, { isLoading: savingRelease }] = useAddAlbumMutation();

  const [presentationName, setPresentationName] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");
  const [artistMessage, setArtistMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [altArtistName, setAltArtistName] = useState("");
  const [label, setLabel] = useState("");
  const [formatIdValue, setFormatIdValue] = useState<number | null>(null);
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);
  const [addedCode, setAddedCode] = useState<string | null>(null);
  // The librarian's override of the release call number, or null while they
  // have not touched the field. Kept as an override rather than a seeded copy
  // so the displayed value derives from the peek during render -- no effect,
  // and no stale second copy of the server's number. Reset to null after a
  // save so the field re-shows the freshly-peeked next number.
  const [codeNumberEdit, setCodeNumberEdit] = useState<string | null>(null);
  // The volume-letters field's value. Plainly the string in the input, with no
  // null "untouched" sentinel: unlike the call number this field is never
  // seeded, so there is no server value for an override to shadow and nothing
  // to distinguish untouched from deliberately cleared. Reset to "" after a
  // save so an override typed for one release cannot silently ride along into
  // the next.
  //
  // Never seeded because `code_volume_letters` subdivides a single
  // `code_number` ("R 7", "R 7A", "R 7B" are volumes of one set), while this
  // form's default `code_number` is the *next* one (`MAX(code_number) + 1`) --
  // so carrying a previous release's letters forward would pair a new set's
  // number with an existing set's volume letter, asserting a volume of a set
  // that does not exist. `/wxycdb`'s own prepopulating screen agrees: it seeds
  // the call number from the same peek but hard-codes the volume letters blank
  // (`rotationReleaseImport.jsp:56`). Offering the next *free* letter for a
  // call number that names an existing set would be a different, coherent
  // feature -- it reads the shelf to find the first unused letter for a set
  // that exists, rather than copying a letter from an unrelated release -- and
  // is deliberately not what this field does.
  const [volumeLettersEdit, setVolumeLettersEdit] = useState("");

  // Seed both editable fields from the server once the card arrives, and
  // re-seed after a save so the inputs show what was stored rather than what
  // was typed -- the backend NFC-normalizes on write.
  useEffect(() => {
    if (artist) {
      setPresentationName(artist.artist_name);
      setAlphabeticalName(artist.alphabetical_name);
    }
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

  const importedMessage =
    imported && artist
      ? importedConfirmation(
          imported.codeNumber != null
            ? formatEntireLibraryCode({
                genreName,
                code_letters: artist.code_letters,
                code_artist_number: artist.code_artist_number,
                genre_id: artist.genre_id,
                code_number: imported.codeNumber,
                code_volume_letters: imported.volumeLetters ?? null,
              })
            : null,
          imported.rotationId,
        )
      : undefined;

  // `fn:trim(format.referenceName)` -- the JSP omits blank-named formats from
  // its dropdown rather than offering an unlabelled option.
  const selectableFormats = (formats ?? []).filter(
    (format) => format.format_name.trim() !== "",
  );
  // A browser <select> with no <option value=""> placeholder falls back to
  // displaying its first option whenever the bound value matches nothing --
  // it never reports that fallback through onChange. Deriving the effective
  // id here keeps the submitted value in step with what the control is
  // already showing, rather than requiring a redundant reselect. `== null`
  // stays reachable only when there is nothing to default to.
  const effectiveFormatId = formatIdValue ?? selectableFormats[0]?.id ?? null;

  const artistCode = artist
    ? formatArtistCodeWithPunctuation({
        code_letters: artist.code_letters,
        code_artist_number: artist.code_artist_number,
        genre_id: artist.genre_id,
      })
    : "";

  // The value in the call-number field: the librarian's edit if they have made
  // one, otherwise the peeked next number, otherwise empty (peek still loading
  // or unreachable). An empty field submits no `code_number`, which is the
  // server's own MAX+1 assignment -- the same fallback the form had before.
  //
  // The peek is trusted only once it has settled. During the refetch a save
  // triggers, `nextRelease` still holds the number just consumed until the new
  // one arrives; showing it would reoffer that number in the field the submit
  // handler reads, filing a duplicate. Gating on the query being idle blanks
  // the field for that in-flight window instead -- the same reason the sibling
  // NewArtistForm treats its peek as stale while fetching.
  // `isUninitialized` as well as `isFetching`: the peek is now keyed on the
  // genre, so it cannot dispatch until the card resolves, and RTK Query
  // subscribes from a passive effect that runs AFTER the first paint on which
  // the form renders. For that one frame the query is neither fetching nor
  // settled, and treating it as settled paints "the release number is assigned
  // when you save" -- a positive claim that nothing will be prefilled --
  // immediately before the number arrives and replaces it.
  const nextReleaseSettled = !nextReleaseFetching && !nextReleaseUninitialized;
  const displayedCodeNumber =
    codeNumberEdit ??
    (nextReleaseSettled && nextRelease?.next_code_number != null
      ? String(nextRelease.next_code_number)
      : "");

  // Whether either name field exceeds the 128-code-point ceiling
  // `PATCH /library/artists/:id` enforces. Close to that handler's check but
  // not identical to it: the server measures
  // `codePointLength(value.normalize('NFC').trim())` and this does not
  // normalize, and NFC is not length-non-increasing -- a composition-exclusion
  // codepoint expands -- so a narrow class of input is refused server-side
  // after passing here. Normalizing here is deferred rather than forgotten:
  // `codePointLength` backs several ceilings in this module and none of them
  // normalize, so the client and server are reconciled in one change, not one
  // helper. Deliberately not an HTML
  // `maxLength` on the inputs below: `maxLength` counts UTF-16 units rather
  // than code points, so it would clip an astral name the column can hold and
  // the server would accept, and -- the more serious defect -- it clips
  // silently as the librarian types or pastes, leaving `handleModifyArtist`
  // to submit the already-truncated value with nothing to refuse. Computed
  // live off the field values so the refusal is visible and submit is
  // disabled the moment either name is too long, not only after a submit
  // attempt.
  const presentationNameTooLong = artistNameTooLong(presentationName);
  const alphabeticalNameTooLong = artistNameTooLong(alphabeticalName);

  const handleModifyArtist = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!artist) return;
    // Backstop for the disabled submit button below -- an over-length value
    // must never reach `updateArtist`, whatever triggered this handler.
    if (presentationNameTooLong || alphabeticalNameTooLong) return;

    // The JSP's pair, worded once in `chooserValidation` and reused here
    // rather than forked: `NewArtistForm` and `CreateLibraryCodeForm` read
    // the same emptiness check off the same two messages, and a second
    // wording for the same condition is how the UI drifts.
    const nameResult = validateNewArtistNames(presentationName, alphabeticalName);
    if (!nameResult.valid) {
      setArtistMessage(nameResult.message);
      return;
    }

    setArtistMessage(null);
    try {
      await updateArtist({
        artistId,
        body: {
          artist_name: presentationName.trim(),
          alphabetical_name: alphabeticalName.trim(),
        },
      }).unwrap();
    } catch (err) {
      // A rename can collide into an existing artist; `isAddArtistConflict`
      // names it rather than reporting a generic failure, the same shape and
      // reason `NewArtistForm` reads it for. Unlike that form's code-triple
      // conflict, this check has no genre of its own to name -- it probes
      // every genre this artist is filed in, so the match named back is not
      // necessarily the one on screen.
      if (isAddArtistConflict(err)) {
        setArtistMessage(
          `${err.data.artist.artist_name} already exists in one of this artist's genres.`,
        );
        return;
      }
      // The global rtkQueryErrorLogger middleware already toasts the
      // server's own message for everything else it can speak for; only
      // fill the gap it leaves silent, or a messaged rejection gets
      // reported twice -- an accurate toast plus a generic inline sentence.
      if (isUnmessagedHttpError(err)) {
        setArtistMessage("Failed to modify the artist.");
      }
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
    if (effectiveFormatId == null) {
      setReleaseMessage("You must select a format before adding this release.");
      return;
    }

    // Both halves of the call code, resolved by the rule this form shares with
    // the compilation bucket's: an out-of-range number is refused here rather
    // than sent to come back as a 400 that names no field.
    const codeFields = resolveReleaseCodeFields(displayedCodeNumber, volumeLettersEdit);
    if (codeFields.refusal !== null) {
      setReleaseMessage(codeFields.refusal);
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
      format_id: effectiveFormatId,
      ...(altArtistName.trim() !== ""
        ? { alternate_artist_name: altArtistName.trim() }
        : {}),
      ...codeFields.bodyFields,
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
      // Drop the override so the field re-shows the next number the peek
      // returns once addAlbum's invalidation of the release-list tag refetches
      // it -- one higher than what was just filed, in the ordinary case.
      setCodeNumberEdit(null);
      setVolumeLettersEdit("");
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
      {(message ?? importedMessage) && (
        <div style={{ textAlign: "center" }} role="status">
          <h5>&nbsp;{message ?? importedMessage}&nbsp;</h5>
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
                <input
                  id={presentationNameId}
                  type="text"
                  size={50}
                  value={presentationName}
                  disabled={savingArtist}
                  onChange={(e) => setPresentationName(e.target.value)}
                />
                {presentationNameTooLong && (
                  <div role="alert" className="artist-error-message">
                    At most {ARTIST_NAME_MAX_LENGTH} characters
                  </div>
                )}
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
                {alphabeticalNameTooLong && (
                  <div role="alert" className="artist-error-message">
                    At most {ARTIST_NAME_MAX_LENGTH} characters
                  </div>
                )}
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
                <input
                  type="submit"
                  value="Modify This Artist"
                  disabled={savingArtist || presentationNameTooLong || alphabeticalNameTooLong}
                />
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
                {/* The artist half ends in the `/` that separates it from the
                    release number, so the field sits directly after it: the
                    call number a librarian reads off the screen and walks to
                    the stacks with. Prepopulated with the peek's authoritative
                    next number rather than a client guess; editable so a lost
                    record's slot can be reused. Blank -> the server assigns. */}
                <input
                  type="text"
                  size={6}
                  inputMode="numeric"
                  aria-label="Release call number"
                  value={displayedCodeNumber}
                  placeholder={
                    nextReleaseFetching && codeNumberEdit === null ? "…" : ""
                  }
                  disabled={savingRelease}
                  onChange={(e) => setCodeNumberEdit(e.target.value)}
                />
                {/* The separator is unconditional, and the letters box carries
                    no `maxLength`. Both match `/wxycdb` by intent rather than by
                    omission -- this screen is a xerox of
                    `wxycdb/.../libraryAdmin/artistCardModify.jsp:88-94`, where
                    the same "Add a Library Release for This Artist:" heading and
                    `Library Code:` label are followed by a `size=3` number box,
                    a literal " - ", and a `size=3` letters box with no
                    `maxlength`. The hyphen here separates two inputs; it is not
                    a rendered code, which is the thing `formatReleaseCode`
                    suppresses a trailing hyphen in. And `maxLength` counts
                    UTF-16 units, so it would refuse the astral input the
                    code-point length check deliberately admits because Backend
                    stores it. */}
                {/* The volume letters that follow the call number
                    (`.../5-A`), for filing a volume of a set at the shown
                    call number -- never prepopulated: see the note on
                    `volumeLettersEdit` above. Blank -> the release is
                    stored with no letters. Normalized to uppercase like
                    `code_letters`, matching how the catalog renders and
                    compares this column (`formatReleaseCode`, Backend's
                    shelf-slot dedup). */}
                -
                <input
                  type="text"
                  size={4}
                  aria-label="Release volume letters"
                  value={volumeLettersEdit}
                  disabled={savingRelease}
                  onChange={(e) => setVolumeLettersEdit(normalizeCodeLetters(e.target.value))}
                />
                {!nextReleaseFetching && displayedCodeNumber.trim() === "" && (
                  <span className="label">
                    &nbsp;— the release number is assigned when you save.
                  </span>
                )}
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
                  value={effectiveFormatId ?? ""}
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
                    <td>
                      <Link href={`/dashboard/library/release/${release.id}`}>
                        {release.album_title}
                      </Link>
                    </td>
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
