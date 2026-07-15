"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { useRegistry } from "@/src/hooks/authenticationHooks";
import { useCallback } from "react";
import { toast } from "sonner";

// "Play this queued song now": resubmit the queue entry to the flowsheet,
// then drop it from the queue. Shared by the desktop row's hover PlayArrow
// and the mobile card's Play button so the submission payload can't drift
// between the two.
export function usePlayNow(entry: FlowsheetSongEntry) {
  const { loading: userloading, info: userData } = useRegistry();
  const [addToFlowsheet] = useAddToFlowsheetMutation();
  const dispatch = useAppDispatch();

  return useCallback(() => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
    // Same gate as convertQueryToSubmission (#701): queue entries can carry
    // `album_id: undefined` (freeform) or a synthesized negative id
    // (library-unlinked bin rows, which BS throws on). Only a real positive
    // album_id may carry the rotation linkage keys (#607).
    const hasLinkedAlbum =
      typeof entry.album_id === "number" && entry.album_id > 0;
    addToFlowsheet({
      track_title: entry.track_title,
      artist_name: entry.artist_name,
      album_title: entry.album_title,
      record_label: entry.record_label,
      request_flag: entry.request_flag,
      segue: entry.segue,
      ...(hasLinkedAlbum && {
        album_id: entry.album_id,
        rotation_id: entry.rotation_id,
        rotation_bin: entry.rotation,
      }),
    } as FlowsheetSubmissionParams)
      .unwrap()
      .then(() => {
        dispatch(flowsheetSlice.actions.removeFromQueue(entry.id));
      })
      .catch((error) => {
        toast.error(`Failed to add to flowsheet: ${error}`);
      });
  }, [addToFlowsheet, dispatch, entry, userData, userloading]);
}
