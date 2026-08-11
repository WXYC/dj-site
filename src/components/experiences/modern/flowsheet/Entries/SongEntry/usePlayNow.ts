"use client";

import { hasLinkedAlbumId } from "@/lib/features/flowsheet/linkage";
import { flowsheetWriteErrorMessage } from "@/lib/features/flowsheet/submission-error";
import {
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import { flowsheetArtistRejection } from "@/lib/features/flowsheet/various-artists-guard";
import { useFlowsheetActions } from "@/src/hooks/flowsheetHooks";
import { useCallback } from "react";
import { toast } from "sonner";

// Shared by the desktop row's hover PlayArrow and the mobile card's Play
// button so the submission payload can't drift between the two.
export function usePlayNow(entry: FlowsheetSongEntry) {
  // Routed through the shared flowsheet chokepoint (rather than a raw
  // mutation trigger) so this replay carries the same auth guard and
  // tag-invalidation refetch every other flowsheet write gets.
  const { addToFlowsheet, removeFromQueue } = useFlowsheetActions();

  return useCallback(() => {
    // A blank artist reaches the queue only through the bin's escape hatch
    // (queued blank rather than carrying the refused credit) or a manual
    // edit to the queue row's artist cell; a literal compilation credit
    // reaches it only from a queue entry rehydrated from localStorage that
    // predates this guard. Neither has anywhere else to be caught before
    // the flowsheet write.
    const rejection = flowsheetArtistRejection(entry.artist_name);
    if (rejection) {
      toast.error(rejection);
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
      .then(() => {
        removeFromQueue(entry.id);
      })
      .catch((error) => {
        toast.error(flowsheetWriteErrorMessage(error));
      });
  }, [addToFlowsheet, removeFromQueue, entry]);
}
