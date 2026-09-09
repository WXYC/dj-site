"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useAddRotationEntryMutation,
  useKillRotationEntryMutation,
} from "@/lib/features/rotation/api";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import { Rotation } from "@/lib/features/rotation/types";
import { AlbumEntry } from "@/lib/features/catalog/types";

/**
 * The one write path for rotation membership, shared by the album modal's
 * classify control and the catalog row's context menu — replacing two
 * hand-rolled orchestrations that disagreed on copy and on whether a re-bin
 * retired the prior entry first.
 *
 * `setRotation` makes single-bin the invariant for the set gesture: the
 * backend keeps a prior unkilled entry active on a bare add, so the prior
 * entries have to be retired for the new bin to replace rather than stack.
 * It adds *before* retiring, because the two orders fail differently and only
 * one of them fails safe. Retiring first and then failing the add leaves the
 * album in no bin at all — invisible to the MD behind a generic error, and it
 * drops the album out of the flowsheet rotation picker DJs use on air.
 * Adding first and then failing a retire leaves it in two bins, which the
 * control renders explicitly with a Kill button each, so the state is visible
 * and recoverable. `kill` remains for removing a single entry without adding
 * a replacement.
 *
 * Returns whether the album ended up in the requested state, so callers can
 * keep the operator's bin selection for a retry instead of clearing it.
 */
export function useAlbumRotationActions(album: AlbumEntry) {
  const [addRotationEntry] = useAddRotationEntryMutation();
  const [killRotationEntry] = useKillRotationEntryMutation();
  const [killingIds, setKillingIds] = useState<Set<number>>(() => new Set());
  const [isSettingRotation, setIsSettingRotation] = useState(false);

  const isKilling = (rotationId: number) => killingIds.has(rotationId);
  const isAnyKillInFlight = killingIds.size > 0;

  // Not wrapped with the shared error toast — `kill` (public) and
  // `setRotation`'s retire loop both call this, and each owns its own single
  // toast on failure so a retire-then-add failure isn't reported twice.
  const killQuiet = async (rotationId: number) => {
    setKillingIds((prev) => new Set(prev).add(rotationId));
    try {
      // No kill_date: the server dates it, avoiding the browser's UTC-tomorrow problem.
      await killRotationEntry({ rotation_id: rotationId }).unwrap();
    } finally {
      setKillingIds((prev) => {
        const next = new Set(prev);
        next.delete(rotationId);
        return next;
      });
    }
  };

  const kill = async (rotationId: number) => {
    try {
      await killQuiet(rotationId);
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error("Could not update rotation.");
      }
    }
  };

  const setRotation = async (
    bin: Rotation | null,
    activeEntries: { rotation_id: number }[],
  ): Promise<boolean> => {
    // Self-contained rather than relying on each caller's own guard: a
    // synthesized row (LML result with no library id) would otherwise POST
    // album_id null, and the non-null assertion below hides that from the
    // compiler.
    if (bin && (album.id == null || album.id <= 0)) return false;

    setIsSettingRotation(true);
    let added = false;
    try {
      if (bin) {
        // Guarded above.
        await addRotationEntry({ album_id: album.id!, rotation_bin: bin }).unwrap();
        added = true;
      }
      // Only once the replacement is on record — see the order note above.
      for (const entry of activeEntries) {
        await killQuiet(entry.rotation_id);
      }
      if (bin) {
        toast.success(`Marked for ${bin} rotation.`);
      } else if (activeEntries.length > 0) {
        toast.success("Removed from rotation.");
      }
      return true;
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        // Naming the half that landed: after a failed retire the album is in
        // the new bin AND still in its old one, which "Could not update
        // rotation." would misreport as nothing having changed.
        toast.error(
          added
            ? `Marked for ${bin} rotation, but could not retire the previous bin.`
            : "Could not update rotation.",
        );
      }
      return false;
    } finally {
      setIsSettingRotation(false);
    }
  };

  return { setRotation, kill, isKilling, isAnyKillInFlight, isSettingRotation };
}
