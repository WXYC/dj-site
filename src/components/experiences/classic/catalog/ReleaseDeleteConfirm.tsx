"use client";

import { useState } from "react";
import { useDeleteAlbumMutation, useGetInformationQuery } from "@/lib/features/catalog/api";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import { formatEntireLibraryCode } from "@/lib/features/catalog/libraryCode";
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
 * server's own sentence, and only an actually-resolved delete reaches the
 * past-tense heading.
 *
 * Divergences from the JSP, each forced rather than chosen:
 *
 *  - **"Time Last Modified" is "Date Added".** `GET /library/info` does not
 *    carry a last-modified value through the published contract, and printing
 *    the add date under the JSP's label would be worse than printing it under
 *    a true one. Same substitution the release editor makes.
 *  - **A plain Delete button, not `delete_75.gif`.** The image lives in the
 *    legacy webapp's asset tree, which classic does not serve.
 *  - **No pre-check hides the delete.** The JSP suppresses its delete link
 *    when the release has cross-references. Backend refuses on a stronger and
 *    more relevant criterion — flowsheet plays, which the JSP happily deleted
 *    through — and it refuses server-side, where the answer cannot go stale
 *    between the check and the click. So the button is always offered and the
 *    409 is the guard.
 */
export default function ReleaseDeleteConfirm({ albumId }: { albumId: number }) {
  const { data, isLoading, isError } = useGetInformationQuery({ album_id: albumId });
  const [deleteAlbum, { isLoading: deleting }] = useDeleteAlbumMutation();

  /**
   * The release as it stood when the delete succeeded. Held because the
   * successful delete invalidates `AlbumDetail`, so the query above refetches
   * and 404s — and rendering the past-tense screen from live data would flip
   * it to a load failure the moment the refetch lands.
   */
  const [deleted, setDeleted] = useState<AlbumEntry | null>(null);
  const [refusal, setRefusal] = useState<ReleaseDeleteRefusal | null>(null);

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
        {isError
          ? "This release could not be loaded, so it cannot be deleted."
          : "This release is not in the catalog."}
      </div>
    );
  }

  // `code_volume_letters` is null for the same reason as on the release
  // editor: `/library/info` does not project it.
  const entireLibraryCode = formatEntireLibraryCode({
    genreName: release.artist.genre,
    code_letters: release.artist.lettercode,
    code_artist_number: release.artist.numbercode,
    genre_id: release.genre_id ?? 0,
    code_number: release.entry,
    code_volume_letters: null,
  });

  const artistId = release.artist.id;
  const added = release.add_date ? formatStationDateTime(release.add_date) : undefined;
  // Offered until the server refuses on the merits. A lock stand-down leaves
  // it standing: that refusal is a "not now", and the next press is the
  // correct response to it.
  const canDelete = !deleted && (refusal === null || refusal.retryable);

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
                <a href={artistCardHref({ id: artistId, code_letters: release.artist.lettercode })}>
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
          <tr>
            <td></td>
            <td>
              {canDelete ? (
                <button type="button" onClick={handleDelete} disabled={deleting}>
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
              href={artistCardHref({ id: artistId, code_letters: release.artist.lettercode })}
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
