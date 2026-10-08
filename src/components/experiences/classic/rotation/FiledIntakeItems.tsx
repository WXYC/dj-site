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
import {
  isIntakeInRotation,
  isIntakeStateChanged,
  reviewsApi,
  useFinalizeIntakeItemMutation,
  useGetIntakeItemsQuery,
} from "@/lib/features/reviews/api";
import { useAppDispatch } from "@/lib/hooks";
import { serverMessage, unwrapEndpointErrorOrRaw } from "@/lib/rtk-endpoint-error";
import { useMounted, useRowWrite } from "@/src/hooks/useRowWrite";
import OutagePanel from "./OutagePanel";

const FILED = { state: "filed" } as const;
const FAILURE_LINE = "Couldn't do that. Please try again.";
type Action = "finalize";

function FiledRow({
  item,
  albumId,
  canWrite,
  write,
  lock,
  finalize,
}: {
  item: IntakeItem;
  albumId: number;
  canWrite: boolean;
  write: ReturnType<typeof useRowWrite<Action>>["write"];
  lock: ReturnType<typeof useRowWrite<Action>>["lock"];
  finalize: (id: number) => Promise<unknown>;
}) {
  const { data: album } = useGetInformationQuery({ album_id: albumId });
  const [updateAlbum] = useUpdateAlbumMutation();
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string>();
  const { disabled: busy } = lock(item.id, "finalize");
  const mounted = useMounted();

  // The row stays locked until the refetched lists land, so it leaves the
  // table or is shown again as it now stands. The PATCH's failure is this
  // row's own line; the finalize's refusal is reported by the screen.
  const run = (change?: number) => {
    setError(undefined);
    return write(item.id, "finalize", async () => {
      if (change !== undefined) {
        try {
          await updateAlbum({ albumId, body: { code_number: change } }).unwrap();
        } catch {
          if (mounted.current) setError(FAILURE_LINE);
          return;
        }
      }
      await finalize(item.id);
    });
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
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setError(undefined);
                }}
              >
                Cancel
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
  // `inRotation` marks the server's own explanation of why the row is about
  // to be hidden, which outlives the row; the generic line belongs to its row.
  const [refusal, setRefusal] = useState<{ id: number; text: string; inRotation: boolean }>();
  const { write, lock } = useRowWrite<Action>({
    // Finalize invalidates only the intake list; the active rotation list is
    // what a 409 `in_rotation` says is stale.
    reload: () => [
      dispatch(reviewsApi.endpoints.getIntakeItems.initiate(FILED, { subscribe: false, forceRefetch: true })),
      dispatch(rotationApi.endpoints.getRotationList.initiate("active", { subscribe: false, forceRefetch: true })),
    ],
    // A lost race (someone else finalized it first) is not an error: the
    // refetched list drops the row, which says what happened.
    isLostRace: isIntakeStateChanged,
    onFailure: (err, id) => {
      // The one refusal this screen quotes: the server's message names the latest kill date.
      const quoted = isIntakeInRotation(err)
        ? serverMessage(unwrapEndpointErrorOrRaw("intakeWriteError", err)?.data)
        : undefined;
      setRefusal({ id, text: quoted || FAILURE_LINE, inRotation: Boolean(quoted) });
    },
  });

  const finalizeItem = (id: number) => {
    setRefusal(undefined);
    return finalize(id).unwrap();
  };

  if (items.isLoading || rotating.isLoading) return <p style={{ textAlign: "center" }}>Loading...</p>;
  if ((items.isError && items.data == null) || (rotating.isError && rotating.data == null)) {
    return (
      <OutagePanel
        onRetry={() => {
          if (items.isError) items.refetch();
          if (rotating.isError) rotating.refetch();
        }}
        retrying={items.isFetching || rotating.isFetching}
      />
    );
  }
  if (!items.data || !rotating.data) return null;

  const inRotation = new Set(rotating.data.map((row) => row.id));
  const rows = items.data.flatMap((item) =>
    item.album_id != null && !inRotation.has(item.album_id) ? [{ item, albumId: item.album_id }] : [],
  );
  const shownRefusal =
    refusal && (refusal.inRotation || rows.some(({ item }) => item.id === refusal.id)) ? refusal.text : undefined;
  if (rows.length === 0 && !shownRefusal) return null;

  return (
    <>
      {shownRefusal && (
        <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
          {shownRefusal}
        </p>
      )}
      {rows.length > 0 && (
        <table className="entry-table" style={{ maxWidth: 1100, margin: "0 auto 15px" }}>
          <caption>Filed, awaiting your confirmation</caption>
          <tbody>
            {rows.map(({ item, albumId }) => (
              <FiledRow
                key={item.id}
                item={item}
                albumId={albumId}
                canWrite={canWrite}
                write={write}
                lock={lock}
                finalize={finalizeItem}
              />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
