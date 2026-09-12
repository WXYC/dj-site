"use client";

import { useId, useState } from "react";
import { useDeleteAlbumMutation, useGetInformationQuery } from "@/lib/features/catalog/api";
import { formatEntireLibraryCode } from "@/lib/features/catalog/libraryCode";
import { interpretReleaseDeleteError } from "@/lib/features/catalog/releaseDeleteOutcome";
import {
  useGetRotationRowQuery,
  useLinkRotationToAlbumMutation,
} from "@/lib/features/rotation/api";
import type { ImportCreatedRelease } from "@/lib/features/rotation/importSubmit";
import {
  isRotationAlreadyLinked,
  linkRotationFailureMessage,
} from "@/lib/features/rotation/importOutcome";

function RecoveryHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ textAlign: "center", margin: "5px 0 15px 0" }}>{children}</h3>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
      {children}
    </p>
  );
}

/**
 * `POST /library` succeeded and the link that was supposed to follow it did
 * not, so a library release exists that no rotation row points at.
 *
 * Retrying the link is the only action offered, and the warning against
 * resubmitting the import form is the screen's real content: the form is
 * still filled in behind this, and submitting it again mints a second library
 * release for a record that is already catalogued. That is the failure this
 * whole screen exists to prevent, which is why nothing here navigates back to
 * the form.
 */
export function RotationImportCreatedNotLinked({
  rotationId,
  created,
  linkError,
  onLinked,
  onAlreadyLinked,
}: {
  rotationId: number;
  created: ImportCreatedRelease;
  /** The rejection from the link that failed, as `linkRotationToAlbum` wraps it. */
  linkError: unknown;
  onLinked: () => void;
  onAlreadyLinked: () => void;
}) {
  const [linkRotationToAlbum, { isLoading }] = useLinkRotationToAlbumMutation();
  const [retryError, setRetryError] = useState<unknown>(undefined);

  const retry = async () => {
    setRetryError(undefined);
    try {
      await linkRotationToAlbum({ rotation_id: rotationId, album_id: created.albumId }).unwrap();
      onLinked();
    } catch (err) {
      // An already-linked refusal is not a failed retry, it is a different
      // situation: something else linked the row, so a second library release
      // now exists and no amount of retrying resolves that.
      if (isRotationAlreadyLinked(err)) {
        onAlreadyLinked();
        return;
      }
      setRetryError(err);
    }
  };

  return (
    <div>
      <RecoveryHeading>The library release was created, but the rotation release was not linked</RecoveryHeading>

      <CreatedReleaseSummary created={created} />

      <Notice>{linkRotationFailureMessage(retryError ?? linkError)}</Notice>

      <p style={{ textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
        Do not submit the import form again. The release above is already in the library, and
        submitting again would create a second library release for it.
      </p>

      <p style={{ textAlign: "center", padding: "15px 0" }}>
        <button type="button" disabled={isLoading} onClick={retry}>
          Link the rotation release
        </button>
      </p>
    </div>
  );
}

function CreatedReleaseSummary({ created }: { created: ImportCreatedRelease }) {
  return (
    <table className="entry-table" style={{ maxWidth: 500, margin: "0 auto" }}>
      <tbody>
        <tr className="entry-row entry-row-even">
          <th scope="row" style={{ textAlign: "right", width: 100 }}>
            Artist:
          </th>
          <td>{created.artistName}</td>
        </tr>
        <tr className="entry-row entry-row-odd">
          <th scope="row" style={{ textAlign: "right" }}>
            Title:
          </th>
          <td>{created.albumTitle}</td>
        </tr>
        <tr className="entry-row entry-row-even">
          <th scope="row" style={{ textAlign: "right" }}>
            Library Code:
          </th>
          <td>{created.libraryCode}</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * The rotation row was linked to some other library release inside the window
 * between this import's staleness check and its link, so this import's own
 * release is a duplicate.
 *
 * Deleting it is offered rather than performed: the two releases are shown
 * side by side first, because which one is the duplicate is a cataloging
 * judgement — the other link may itself be the mistake — and this is the one
 * irreversible action on the screen.
 */
export function RotationImportLinkConflict({
  rotationId,
  created,
  onDeleted,
}: {
  rotationId: number;
  created: ImportCreatedRelease;
  onDeleted: () => void;
}) {
  const comparisonHeadingId = useId();
  const { data: row } = useGetRotationRowQuery(rotationId);
  const linkedAlbumId = row?.album_id ?? undefined;
  const { data: linked } = useGetInformationQuery(
    { album_id: linkedAlbumId as number },
    { skip: linkedAlbumId == null },
  );
  const [deleteAlbum, { isLoading }] = useDeleteAlbumMutation();
  const [refusal, setRefusal] = useState<ReturnType<typeof interpretReleaseDeleteError> | undefined>(
    undefined,
  );

  const linkedCode =
    linked != null
      ? formatEntireLibraryCode({
          genreName: linked.artist.genre,
          code_letters: linked.artist.lettercode,
          code_artist_number: linked.artist.numbercode,
          genre_id: linked.genre_id ?? 0,
          code_number: linked.entry,
          code_volume_letters: null,
        })
      : "";

  const remove = async () => {
    setRefusal(undefined);
    try {
      await deleteAlbum({ albumId: created.albumId, artistId: created.artistId }).unwrap();
      onDeleted();
    } catch (err) {
      setRefusal(interpretReleaseDeleteError(err));
    }
  };

  return (
    <div>
      <RecoveryHeading>This rotation release was linked while you were cataloging it</RecoveryHeading>

      <table
        className="entry-table"
        style={{ maxWidth: 700, margin: "0 auto" }}
        aria-labelledby={comparisonHeadingId}
      >
        <tbody>
          <tr className="entry-header">
            <th colSpan={3} id={comparisonHeadingId} style={{ textAlign: "center" }}>
              Already linked, and what this import created
            </th>
          </tr>
          <tr className="entry-row entry-row-even">
            <th scope="row" style={{ textAlign: "right", width: 200 }}>
              Already linked:
            </th>
            <td>{linked ? `${linked.artist.name} — ${linked.title}` : ""}</td>
            <td>{linkedCode}</td>
          </tr>
          <tr className="entry-row entry-row-odd">
            <th scope="row" style={{ textAlign: "right" }}>
              Created by this import:
            </th>
            <td>{`${created.artistName} — ${created.albumTitle}`}</td>
            <td>{created.libraryCode}</td>
          </tr>
        </tbody>
      </table>

      {refusal && <Notice>{refusal.message}</Notice>}

      {/* Withdrawn once the server refuses on the merits: pressing again is
          futile, and a live button beside a refusal reads as an invitation to
          keep trying. A lock stand-down says nothing about deletability, so
          it keeps the button. */}
      {(refusal == null || refusal.retryable) && (
        <p style={{ textAlign: "center", padding: "15px 0" }}>
          <button type="button" disabled={isLoading} onClick={remove}>
            Delete the release this import created
          </button>
        </p>
      )}
    </div>
  );
}
