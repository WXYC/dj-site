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
 * `setRotation` retires every entry passed in `activeEntries` before adding
 * the new bin, making single-bin the invariant for the set gesture: the
 * backend keeps a prior unkilled entry active on a bare add, so skipping the
 * retire step would stack bins instead of replacing one. `kill` remains for
 * removing a single entry without adding a replacement.
 */
export function useAlbumRotationActions(album: AlbumEntry) {
  const [addRotationEntry] = useAddRotationEntryMutation();
  const [killRotationEntry] = useKillRotationEntryMutation();
  const [killingIds, setKillingIds] = useState<Set<number>>(() => new Set());
  const [isSettingRotation, setIsSettingRotation] = useState(false);

  const isKilling = (rotationId: number) => killingIds.has(rotationId);

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
  ) => {
    setIsSettingRotation(true);
    try {
      // Retire every active entry first, or a new bin would stack on top of the old one.
      for (const entry of activeEntries) {
        await killQuiet(entry.rotation_id);
      }
      if (bin) {
        // Guarded by the caller's albumIdValid check.
        await addRotationEntry({ album_id: album.id!, rotation_bin: bin }).unwrap();
        toast.success(`Marked for ${bin} rotation.`);
      } else if (activeEntries.length > 0) {
        toast.success("Removed from rotation.");
      }
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error("Could not update rotation.");
      }
    } finally {
      setIsSettingRotation(false);
    }
  };

  return { setRotation, kill, isKilling, isSettingRotation };
}
