"use client";

import { useState } from "react";
import {
  useDeleteAlbumMutation,
  useGetFlowsheetPlayCountsQuery,
  useGetInformationQuery,
} from "@/lib/features/catalog/api";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import { formatEntireLibraryCode } from "@/lib/features/catalog/libraryCode";
import {
  formatReleaseDeletePlayImpact,
  RELEASE_PLAY_COUNTS_UNREADABLE_MESSAGE,
} from "@/lib/features/catalog/releaseDeletePlayImpact";
import {
  interpretReleaseDeleteError,
  type ReleaseDeleteRefusal,
} from "@/lib/features/catalog/releaseDeleteOutcome";
import { formatStationDateTime } from "@/src/utilities/stationTime";
import type { AlbumEntry } from "@/lib/features/catalog/types";

/**
 * "Delete a Library Release" — the confirmation screen and its aftermath,
 * reproducing `libraryAdmin/libraryReleaseDelete.jsp` and
 * `libraryReleaseDeleted.jsp`.
 *
 * One component for the JSP's two pages, because they are the same six rows
 * under two headings; the legacy pair are separate only because a servlet
 * forward cannot re-render in place. The delete itself is irreversible, so
 * every state here is explicit and none of them is inferred from absence: a
 * release that failed to load offers no button at all, a refusal states the
 * one sentence `releaseDeleteOutcome.ts` chose for it, and only an
 * actually-resolved delete reaches the past-tense heading. The refusal copy
 * is client-owned by the house convention -- the lock stand-down is the sole
 * outcome that prefers the server's own sentence, because what a locked row is
 * waiting on is the one detail this screen cannot reconstruct.
 *
 * Divergences from the JSP, each forced rather than chosen:
 *
 *  - **"Time Last Modified" is "Date Added".** `GET /library/info` does not
 *    carry a last-modified value through the published contract, and printing
 *    the add date under the JSP's label would be worse than printing it under
 *    a true one. Same substitution the release editor makes.
 *  - **A plain Delete button, not `delete_75.gif`.** The image lives in the
 *    legacy webapp's asset tree, which classic does not serve.
 *  - **No pre-check hides the delete, and flowsheet plays no longer refuse
 *    it.** The JSP suppresses its delete link when the release has
 *    cross-references; the classic editor offers it unconditionally. A
 *    release with plays used to be refused server-side — the JSP deleted
 *    straight through the same case — but that refusal is gone: a single
 *    release is one card, and restating a play count the librarian already
 *    knows guards nothing a typo could catch. What remains is informational
 *    rather than a gate — `useGetFlowsheetPlayCountsQuery` reads the release's
 *    flowsheet plays by arm purely so the screen can state what the delete
 *    will do before the button is pressed, since `deleteAlbum`'s own response
 *    arrives too late to inform a decision already made. The read is
 *    advisory and can go stale before the click; it is not a lock.
 */
export default function ReleaseDeleteConfirm({ albumId }: { albumId: number }) {
  const { data, isLoading, isError } = useGetInformationQuery({ album_id: albumId });
  const [deleteAlbum, { isLoading: deleting }] = useDeleteAlbumMutation();

  /**
   * The release as it stood when the delete succeeded. Rendering the
   * past-tense screen from live data would flip it to a load failure the
   * moment the row behind it stops resolving — the delete makes `data` a read
   * of something that no longer exists, and the librarian would be told the
   * delete broke having just watched it work. `deleteAlbum` deliberately does
   * not invalidate `AlbumDetail` (see its `invalidatesTags`), so nothing
   * forces that refetch; this holds the screen steady anyway, because the
   * cache entry may still be evicted or refetched for reasons this component
   * does not control.
   */
  const [deleted, setDeleted] = useState<AlbumEntry | null>(null);
  const [refusal, setRefusal] = useState<ReleaseDeleteRefusal | null>(null);

  // Skipped once the delete has already succeeded: refetching against a
  // now-deleted id would 404, and that has nothing to do with the delete
  // that already happened. The counts this screen showed before the click
  // stay on screen exactly like the rest of the frozen `deleted` snapshot.
  const {
    data: playCounts,
    isError: playCountsError,
  } = useGetFlowsheetPlayCountsQuery(albumId, { skip: deleted !== null });

  // `keepUnusedDataFor: 0` means this read is cold on every visit, so the
  // screen genuinely paints before it lands -- the release row itself resolves
  // from an already-warm `getInformation` entry. Settled covers both landings:
  // the counts arrived, or the read failed and never will.
  const playCountsSettled = playCountsError || playCounts !== undefined;

  const release = deleted ?? data;

  if (!release) {
    if (isLoading) {
      return (
        <div className="label" style={{ textAlign: "center" }}>
          Loading the release...
        </div>
      );
    }
    return (
      <div data-testid="release-delete-error" role="alert" className="artist-error-message">
        {/* Not split into "missing" and "unreachable": a genuine 404 arrives
            as `isError` with a parseable body, while the `!isError && !data`
            case is the base query soft-failing a non-JSON response — an
            outage. Naming that one "not in the catalog" would make an outage
            read as a positive claim about the shelf. Either way the delete
            cannot proceed, so the editor's single sentence is the honest
            one. */}
        This release could not be loaded, so it cannot be deleted.
      </div>
    );
  }

  // The whole shelf code, volume letters included: this screen names the row
  // about to be deleted irreversibly, and two releases in one call number are
  // told apart by exactly the half a partial code would drop.
  const entireLibraryCode = formatEntireLibraryCode({
    genreName: release.artist.genre,
    code_letters: release.artist.lettercode,
    code_artist_number: release.artist.numbercode,
    genre_id: release.genre_id ?? 0,
    code_number: release.entry,
    code_volume_letters: release.code_volume_letters ?? null,
  });

  const artistId = release.artist.id;
  const added = release.add_date ? formatStationDateTime(release.add_date) : undefined;
  // Offered until the server refuses on the merits. A lock stand-down leaves
  // it standing: that refusal is a "not now", and the next press is the
  // correct response to it.
  const canDelete = !deleted && (refusal === null || refusal.retryable);

  // Offered and pressable are different states, and collapsing them is what
  // makes the play-impact read pointless: a live Delete sitting over
  // "Checking flowsheet plays..." lets the librarian commit the irreversible
  // write having been told nothing, which is the state the read exists to
  // prevent. So the button stays rendered -- withdrawing it here would flip
  // Cancel to the refusal's "Back to this release" and read as a refusal that
  // has not happened -- and goes live when the sentence beside it does.
  //
  // The wait is one cold request, not an open-ended one: a read that FAILS is
  // settled, because it will never resolve and holding the button on it would
  // turn an advisory read into the gate it was explicitly not made.
  const deletePressable = canDelete && playCountsSettled && !deleting;

  // Never guessed. A count this screen could not read must not render as
  // "no plays" -- the one claim it cannot support -- so an unreadable read
  // gets its own honest sentence instead of falling back to the zero-play
  // message or a blank row. A rejected read says so here; a read that
  // ANSWERED without countable arms says so from inside
  // `formatReleaseDeletePlayImpact`, in the same words, because the two are
  // one fact from where the librarian sits.
  //
  // Whether the delete is offered is decided above; only the "Checking..."
  // state holds the button, and it holds it because a blank promise is the one
  // thing this row must not be when the button beside it is live.
  const playImpactMessage = deleted
    ? null
    : playCountsError
      ? RELEASE_PLAY_COUNTS_UNREADABLE_MESSAGE
      : playCounts
        ? formatReleaseDeletePlayImpact(playCounts)
        : "Checking flowsheet plays...";

  const handleDelete = async () => {
    setRefusal(null);
    try {
      await deleteAlbum({ albumId, ...(artistId != null ? { artistId } : {}) }).unwrap();
      // Snapshot before the invalidated query can resolve to nothing.
      setDeleted(release);
    } catch (error) {
      setRefusal(interpretReleaseDeleteError(error));
    }
  };

  return (
    <div id="releaseDeleteCard" data-testid={deleted ? "release-deleted" : "release-delete-confirm"}>
      <table cellPadding={5}>
        <tbody>
          <tr>
            <td></td>
            <td>
              <h3>
                {deleted
                  ? "The following Library Release has been deleted:"
                  : "Delete a Library Release"}
              </h3>
            </td>
          </tr>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Library Code:</b>
            </th>
            <td data-testid="release-delete-library-code">{entireLibraryCode}</td>
          </tr>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Artist:</b>
            </th>
            <td data-testid="release-delete-artist">
              {artistId != null ? (
                <a
                  href={artistCardHref(
                    { id: artistId, code_letters: release.artist.lettercode },
                    { genreId: release.genre_id ?? null },
                  )}
                >
                  {release.artist.name}
                </a>
              ) : (
                release.artist.name
              )}
            </td>
          </tr>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Alternate Artist Name:</b>
            </th>
            <td data-testid="release-delete-alternate-artist">{release.alternate_artist ?? ""}</td>
          </tr>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Title of Release:</b>
            </th>
            <td data-testid="release-delete-title">{release.title}</td>
          </tr>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Format:</b>
            </th>
            <td data-testid="release-delete-format">{release.format}</td>
          </tr>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Date Added:</b>
            </th>
            <td data-testid="release-delete-added">{added ? `${added.time} ${added.day}` : ""}</td>
          </tr>
          {playImpactMessage ? (
            <tr>
              <td></td>
              {/* Announced on arrival: the cell is painted as "Checking..."
                  and rewritten in place a moment later, so a screen-reader
                  user who has already passed it would otherwise never hear
                  the sentence the whole screen is here to deliver. `polite`
                  rather than `assertive` -- it is not an alert, and the
                  Delete button beside it is disabled until it lands. */}
              <td data-testid="release-delete-play-impact" aria-live="polite">
                {playImpactMessage}
              </td>
            </tr>
          ) : null}
          <tr>
            <td></td>
            <td>
              {canDelete ? (
                <button type="button" onClick={handleDelete} disabled={!deletePressable}>
                  Delete
                </button>
              ) : null}
              {!deleted ? (
                <>
                  &nbsp;&nbsp;
                  <a href={`/dashboard/library/release/${albumId}`}>
                    {canDelete ? "Cancel" : "Back to this release"}
                  </a>
                </>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>

      {refusal ? (
        <div
          data-testid="release-delete-refusal"
          role="alert"
          className="artist-error-message"
        >
          {refusal.message}
        </div>
      ) : null}

      <div className="label" style={{ textAlign: "center" }}>
        <a href="/dashboard/catalog">Do another search</a>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <a href="/dashboard/library">Find and Create an Artist and/or Library Code</a>
        {artistId != null ? (
          <>
            &nbsp;&nbsp;&nbsp;&nbsp;
            <a
              href={artistCardHref(
                { id: artistId, code_letters: release.artist.lettercode },
                { genreId: release.genre_id ?? null },
              )}
              data-testid="release-delete-back-to-artist"
            >
              Back to the artist card
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}
