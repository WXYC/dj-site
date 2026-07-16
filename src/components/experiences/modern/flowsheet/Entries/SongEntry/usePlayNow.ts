"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { hasLinkedAlbumId } from "@/lib/features/flowsheet/linkage";
import {
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { useRegistry } from "@/src/hooks/authenticationHooks";
import { useCallback } from "react";
import { toast } from "sonner";

// Shared by the desktop row's hover PlayArrow and the mobile card's Play
// button so the submission payload can't drift between the two.
export function usePlayNow(entry: FlowsheetSongEntry) {
  const { loading: userloading, info: userData } = useRegistry();
  const [addToFlowsheet] = useAddToFlowsheetMutation();
  const dispatch = useAppDispatch();

  return useCallback(() => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
    // Queue entries can carry `album_id: undefined` (freeform) or a
    // synthesized negative id (library-unlinked bin rows, which BS throws
    // on — #701). Only a real positive album_id may go on the wire (#607).
    // rotation_id stays either way: the freeform variant carries it since
    // BS#1308 so unlinked rotation plays keep their linkage (mirrors
    // convertBinToFlowsheet).
    addToFlowsheet({
      track_title: entry.track_title,
      artist_name: entry.artist_name,
      album_title: entry.album_title,
      record_label: entry.record_label,
      request_flag: entry.request_flag,
      segue: entry.segue,
      rotation_id: entry.rotation_id,
      ...(hasLinkedAlbumId(entry.album_id) && {
        album_id: entry.album_id,
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
