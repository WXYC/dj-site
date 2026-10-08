"use client";

import { useState } from "react";
import type { IntakeItem } from "@wxyc/shared";
import {
  parseReleaseCodeNumber,
  RELEASE_CODE_NUMBER_OUT_OF_RANGE_MESSAGE,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { useGetInformationQuery, useUpdateAlbumMutation } from "@/lib/features/catalog/api";
import { formatAlbumEntryLibraryCode } from "@/lib/features/catalog/libraryCode";
import { rotationApi, useGetRotationListQuery } from "@/lib/features/rotation/api";
import { reviewsApi, useFinalizeIntakeItemMutation, useGetIntakeItemsQuery } from "@/lib/features/reviews/api";
import { useAppDispatch } from "@/lib/hooks";
import { bodyReason, serverMessage, unwrapEndpointError } from "@/lib/rtk-endpoint-error";

const FILED = { state: "filed" } as const;
const FAILURE_LINE = "Couldn't do that. Please try again.";

function FiledRow({
  item,
  albumId,
  canWrite,
  onFinalize,
}: {
  item: IntakeItem;
  albumId: number;
  canWrite: boolean;
  onFinalize: (id: number) => Promise<void>;
}) {
  const { data: album } = useGetInformationQuery({ album_id: albumId });
  const [updateAlbum] = useUpdateAlbumMutation();
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // `onFinalize` reports its own refusal; only the PATCH can fail here.
  const run = async (change?: number) => {
    setBusy(true);
    setError(undefined);
    try {
      if (change !== undefined) await updateAlbum({ albumId, body: { code_number: change } }).unwrap();
      await onFinalize(item.id);
    } catch {
      setError(FAILURE_LINE);
    }
    setBusy(false);
  };

  const saveAndConfirm = () => {
    const parsed = parseReleaseCodeNumber(number);
    if (parsed === null) return setError(RELEASE_CODE_NUMBER_OUT_OF_RANGE_MESSAGE);
    return run(parsed);
  };

  return (
    <tr className="entry-row">
      <td>{item.artist_name}</td>
      <td>{item.album_title}</td>
      <td>{item.record_label}</td>
      <td>{album ? formatAlbumEntryLibraryCode(album) : "—"}</td>
      {canWrite && (
        <td>
          {editing ? (
            <>
              <label>
                Call number
                <input value={number} onChange={(e) => setNumber(e.target.value)} />
              </label>
              <button type="button" disabled={busy} onClick={saveAndConfirm}>
                Save and confirm
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} aria-label={`Confirm: ${item.album_title}`} onClick={() => run()}>
                Confirm
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={`Change the code: ${item.album_title}`}
                onClick={() => {
                  setNumber(album ? String(album.entry) : "");
                  setEditing(true);
                }}
              >
                Change the code
              </button>
            </>
          )}
          {error && <span role="alert">{error}</span>}
        </td>
      )}
    </tr>
  );
}

/**
 * Filed, not yet finalized intake items, beside the typed-text rows of
 * Awaiting Cataloging. A rotation item is hidden while its release is in
 * active rotation, judged by the server's own `status=active` list rather than
 * by comparing a kill date with this browser's clock.
 */
export default function FiledIntakeItems({ canWrite }: { canWrite: boolean }) {
  const dispatch = useAppDispatch();
  const items = useGetIntakeItemsQuery(FILED);
  const rotating = useGetRotationListQuery("active");
  const [finalize] = useFinalizeIntakeItemMutation();
  const [refusal, setRefusal] = useState<string>();

  const onFinalize = async (id: number) => {
    setRefusal(undefined);
    try {
      await finalize(id).unwrap();
    } catch (err) {
      const inner = unwrapEndpointError("intakeWriteError", err);
      // The one refusal this screen quotes: the server's message names the latest kill date.
      const inRotation = inner?.status === 409 && bodyReason(inner.data) === "in_rotation";
      setRefusal((inRotation && serverMessage(inner.data)) || FAILURE_LINE);
      await Promise.allSettled([
        dispatch(reviewsApi.endpoints.getIntakeItems.initiate(FILED, { subscribe: false, forceRefetch: true })),
        dispatch(rotationApi.endpoints.getRotationList.initiate("active", { subscribe: false, forceRefetch: true })),
      ]);
    }
  };

  if (!items.data || !rotating.data) return null;
  const inRotation = new Set(rotating.data.map((row) => row.id));
  const rows = items.data.flatMap((item) =>
    item.album_id != null && !inRotation.has(item.album_id) ? [{ item, albumId: item.album_id }] : [],
  );
  if (rows.length === 0 && !refusal) return null;

  return (
    <>
      {refusal && (
        <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
          {refusal}
        </p>
      )}
      <table className="entry-table" style={{ maxWidth: 1100, margin: "0 auto 15px" }}>
        <caption>Filed, awaiting your confirmation</caption>
        <tbody>
          {rows.map(({ item, albumId }) => (
            <FiledRow key={item.id} item={item} albumId={albumId} canWrite={canWrite} onFinalize={onFinalize} />
          ))}
        </tbody>
      </table>
    </>
  );
}
