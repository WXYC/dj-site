"use client";

import { toast } from "sonner";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { addThenRetire } from "@/lib/features/rotation/addThenRetire";
import {
  freeTextRotationMoveRequest,
  rotationMoveRetireIds,
} from "@/lib/features/rotation/adminList";
import {
  useAddFreeTextRotationEntryMutation,
  useAddRotationEntryMutation,
  useKillRotationEntryMutation,
  useLazyGetRotationRowQuery,
} from "@/lib/features/rotation/api";
import {
  ROTATION_MOVE_NOT_ELIGIBLE_MESSAGE,
  isRotationMoveNotEligible,
  rotationWriteErrorMessage,
} from "@/lib/features/rotation/writeErrorMessage";
import {
  ROTATION_BIN_LABELS,
  type RotationBin,
  type RotationListRow,
  type RotationRowSummary,
} from "@/lib/features/rotation/types";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import { useAppDispatch } from "@/lib/hooks";

/**
 * The shelf's cross-bin move. `rows` is the full `status=all` read the move
 * retires duplicates against. Every failure settles into its own toast, so
 * the returned function never rejects for a shape it expects.
 */
export function useRotationBinMove(rows: RotationListRow[] | undefined) {
  const dispatch = useAppDispatch();
  const [killRotationEntry] = useKillRotationEntryMutation();
  const [addRotationEntry] = useAddRotationEntryMutation();
  const [addFreeTextRotationEntry] = useAddFreeTextRotationEntryMutation();
  const [fetchRotationRow] = useLazyGetRotationRowQuery();

  // The cross-bin move: add-then-kill through the shared ordering, since no
  // endpoint edits a bin in place. The add carries no card_id — the server
  // files an omitted card on the target bin's newest, exactly where a move
  // lands — but it carries everything else the source row holds (`urls`,
  // and an unlinked row's pre-catalog fields), because the kill half
  // retires the only row that holds them. The `urls` carry is stored only
  // by a Backend that admits the key on the add; an older
  // backend's allowlist drops it silently, which is harmless. It goes
  // through the same mutations the classify gesture drives, never a
  // hand-rolled orchestration that could reverse the halves.
  const moveRow = async (row: RotationListRow, targetBin: RotationBin) => {
    let add: (() => Promise<unknown>) | null = null;
    if (row.id != null) {
      const albumId = row.id;
      add = () =>
        addRotationEntry({
          album_id: albumId,
          rotation_bin: targetBin,
          ...(row.urls?.length ? { urls: row.urls } : {}),
        }).unwrap();
    } else {
      // The list read's `label_id`/`format_name` are the library join's —
      // null by construction on an unlinked row — so the row's own
      // pre-catalog `format_id`/`label_id` are only readable from the
      // single-row read. The read exists here to feed the write, so it
      // fails closed (the write-precondition contract): proceeding without
      // it would re-file the release with those fields silently dropped,
      // exactly the loss the fetch is for.
      let detail: RotationRowSummary;
      try {
        detail = await fetchRotationRow(row.rotation_id).unwrap();
      } catch {
        toast.error(
          `Couldn't move this release to ${ROTATION_BIN_LABELS[targetBin]} — nothing changed.`,
        );
        return;
      }
      const freeTextRequest = freeTextRotationMoveRequest(row, targetBin, detail);
      if (freeTextRequest != null) {
        add = () => addFreeTextRotationEntry(freeTextRequest).unwrap();
      }
    }
    // Unreachable behind the chips' own canMoveRotationRow gate; a bare kill
    // here would be a move that loses the record, so refuse instead.
    if (add == null) return;

    try {
      const outcome = await addThenRetire(
        add,
        rotationMoveRetireIds(rows ?? [], row, targetBin),
        (rotationId) => killRotationEntry({ rotation_id: rotationId }).unwrap(),
      );

      if (outcome.step === "add-failed") {
        if (isRotationMoveNotEligible(outcome.error)) {
          // The rejected add's tag invalidation rereads the list.
          toast.error(ROTATION_MOVE_NOT_ELIGIBLE_MESSAGE);
          return;
        }
        // The free-text add's refusals are wrapped out of the middleware toast
        // (so the server's own sentence lands here); the catalogued add's
        // reach it, and only the shapes it stays silent about are this row's.
        if (isUnmessagedHttpError(outcome.error)) {
          toast.error(
            rotationWriteErrorMessage(
              outcome.error,
              `Couldn't move this release to ${ROTATION_BIN_LABELS[targetBin]} — nothing changed.`,
            ),
          );
        }
        return;
      }
      if (outcome.retireFailures.length === 0) {
        toast.success(`Moved to ${ROTATION_BIN_LABELS[targetBin]} rotation.`);
        return;
      }
      if (outcome.retireFailures.some(({ error }) => isUnmessagedHttpError(error))) {
        // Naming the state that resulted: the release is filed in more bins
        // than intended — visible in this list, recoverable with each
        // leftover row's own Kill. Named singular only when the one failed
        // retire is the moved row itself; a failed target-bin duplicate
        // retire is not "the <source bin> entry".
        const single =
          outcome.retireFailures.length === 1 &&
          outcome.retireFailures[0].rotationId === row.rotation_id;
        toast.error(
          single
            ? `Filed in ${ROTATION_BIN_LABELS[targetBin]}, but couldn't retire the ${ROTATION_BIN_LABELS[row.rotation_bin]} entry — retire it from the shelf.`
            : `Filed in ${ROTATION_BIN_LABELS[targetBin]}, but couldn't retire every prior entry — retire them from the shelf.`,
        );
      }
    } finally {
      // The add's cache handler wrote a per-album rotation claim into the
      // catalog slice; inside this gesture it stops the kill half from
      // clearing the bin the add just recorded, but outside it the claim is
      // a guess about the server with no expiry — left in place it survives
      // the tab, and once another surface replaces the entry out of band a
      // later kill of the real entry no longer matches it and skips the
      // catalog clear. Its lifetime is bounded to the gesture, exactly as
      // `useAlbumRotationActions.setRotation` bounds it.
      if (row.id != null) {
        dispatch(catalogSlice.actions.clearAlbumRotation(row.id));
      }
    }
  };

  return moveRow;
}
