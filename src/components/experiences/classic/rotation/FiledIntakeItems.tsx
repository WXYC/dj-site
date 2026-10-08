"use client";

import { useEffect, useRef, useState } from "react";
import type { IntakeItem } from "@wxyc/shared";
import {
  parseReleaseCodeNumber,
  RELEASE_CODE_NUMBER_OUT_OF_RANGE_MESSAGE,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { useGetInformationQuery, useUpdateAlbumMutation } from "@/lib/features/catalog/api";
import { formatAlbumEntryLibraryCode } from "@/lib/features/catalog/libraryCode";
import { rotationApi, useGetRotationListQuery } from "@/lib/features/rotation/api";
import {
  isIntakeStateChanged,
  reviewsApi,
  useFinalizeIntakeItemMutation,
  useGetIntakeItemsQuery,
} from "@/lib/features/reviews/api";
import { useAppDispatch } from "@/lib/hooks";
import { bodyReason, serverMessage, unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import OutagePanel from "./OutagePanel";

const FILED = { state: "filed" } as const;
const FAILURE_LINE = "Couldn't do that. Please try again.";

/** False once the component has unmounted, so a write that outlives it touches no state. */
function useMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

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
  // The synchronous guard: a second click that lands before the re-render is a no-op.
  const inFlight = useRef(false);
  const mounted = useMounted();

  // `onFinalize` reports its own refusal and resolves only once the refetched
  // lists have landed, so the row stays locked until it leaves the table or
  // is shown again as it now stands. Only the PATCH can fail here.
  const run = async (change?: number) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (change !== undefined) await updateAlbum({ albumId, body: { code_number: change } }).unwrap();
      await onFinalize(item.id);
    } catch {
      if (mounted.current) setError(FAILURE_LINE);
    }
    inFlight.current = false;
    if (mounted.current) setBusy(false);
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
  const mounted = useMounted();

  const onFinalize = async (id: number) => {
    setRefusal(undefined);
    try {
      await finalize(id).unwrap();
    } catch (err) {
      const inner = unwrapEndpointError("intakeWriteError", err);
      // The one refusal this screen quotes: the server's message names the latest kill date.
      const inRotation = inner?.status === 409 && bodyReason(inner.data) === "in_rotation";
      const quoted = inRotation ? serverMessage(inner.data) : undefined;
      // A lost race (someone else finalized it first) is not an error: the
      // refetched list drops the row, which says what happened.
      if (!isIntakeStateChanged(err) && mounted.current) {
        setRefusal({ id, text: quoted || FAILURE_LINE, inRotation: Boolean(quoted) });
      }
    }
    // Both lists reload on every outcome, and the row stays locked until they
    // land. Finalize invalidates only the intake list; the active rotation list
    // is what a 409 `in_rotation` says is stale. Through the store, not the
    // hooks' `refetch`, which throws once the page has unmounted; `allSettled`
    // never rejects.
    await Promise.allSettled([
      dispatch(reviewsApi.endpoints.getIntakeItems.initiate(FILED, { subscribe: false, forceRefetch: true })),
      dispatch(rotationApi.endpoints.getRotationList.initiate("active", { subscribe: false, forceRefetch: true })),
    ]);
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
              <FiledRow key={item.id} item={item} albumId={albumId} canWrite={canWrite} onFinalize={onFinalize} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
