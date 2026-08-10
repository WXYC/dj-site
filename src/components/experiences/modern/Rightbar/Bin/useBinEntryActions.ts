"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { AlbumEntry } from "@/lib/features/catalog/types";
import {
  convertBinToFlowsheet,
  convertBinToQueue,
} from "@/lib/features/bin/conversions";
import {
  FlowsheetQuery,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import {
  releaseCreditIsRefused,
  VARIOUS_ARTISTS_BIN_PLAY_MESSAGE,
} from "@/lib/features/flowsheet/various-artists-guard";
import { useAppDispatch } from "@/lib/hooks";
import {
  InfoOutlined,
  PlayArrowOutlined,
  PlaylistAdd,
  Unarchive,
} from "@mui/icons-material";
import { ColorPaletteProp } from "@mui/joy";
import { useMemo } from "react";
import { toast } from "sonner";

export type BinEntryAction = {
  id: string;
  label: string;
  Icon: React.ElementType;
  color: ColorPaletteProp;
  // `shiftKey` comes from the triggering click so Shift+click variants work
  // without a global key listener.
  run: (opts?: { shiftKey?: boolean }) => void;
  // Shift+click also removes the album from the bin (the classic
  // one-gesture "queue it and file it away" flow).
  shiftRemoves?: boolean;
};

/**
 * The write callbacks each bin row needs. Hoisted once in BinContent (the
 * underlying hooks subscribe to the whole flowsheet/queue state, far too
 * heavy to run per row) and threaded down to every row.
 */
export type BinEntryActionDeps = {
  addToQueue: (entry: FlowsheetQuery) => void;
  addToFlowsheet: (entry: FlowsheetSubmissionParams) => Promise<unknown>;
  deleteFromBin: (album_id: number) => void;
};

/**
 * Shared by the hover icon buttons and the right-click context menu so both
 * stay in sync.
 */
export function useBinEntryActions(
  entry: AlbumEntry,
  live: boolean,
  { addToQueue, addToFlowsheet, deleteFromBin }: BinEntryActionDeps,
): BinEntryAction[] {
  const dispatch = useAppDispatch();

  return useMemo(() => {
    const actions: BinEntryAction[] = [
      {
        id: "info",
        label: "More information",
        Icon: InfoOutlined,
        color: "neutral",
        run: () =>
          dispatch(
            applicationSlice.actions.openPanel({
              type: "album-detail",
              albumId: entry.id,
            }),
          ),
      },
    ];

    if (live) {
      actions.push({
        id: "queue",
        label: "Add to Queue",
        Icon: PlaylistAdd,
        color: "success",
        shiftRemoves: true,
        run: (opts) => {
          addToQueue(convertBinToQueue(entry));
          // A refused credit is queued with a blank artist rather than the
          // credit, so the success toast has to say what is still missing —
          // otherwise the DJ meets the requirement for the first time at
          // the Play refusal, with no idea it was coming.
          toast.success(
            releaseCreditIsRefused(entry)
              ? `Added ${entry.title} to queue. Name the performer in the artist cell before playing it.`
              : `Added ${entry.title} to queue`
          );
          if (opts?.shiftKey) deleteFromBin(entry.id);
        },
      });
      actions.push({
        id: "play",
        label: "Play Now",
        Icon: PlayArrowOutlined,
        color: "primary",
        shiftRemoves: true,
        run: (opts) => {
          const submission = convertBinToFlowsheet(entry);
          if (!submission) {
            // No artist field to satisfy the refusal in place — point the DJ
            // at the escape hatch instead of just saying no.
            toast.error(VARIOUS_ARTISTS_BIN_PLAY_MESSAGE);
            return;
          }
          addToFlowsheet(submission)
            // Only file the album away once it actually reached the
            // flowsheet — a failed play shouldn't also lose the bin entry.
            .then(() => {
              if (opts?.shiftKey) deleteFromBin(entry.id);
            })
            .catch(() =>
              toast.error(`Failed to add ${entry.title} to flowsheet`),
            );
        },
      });
    }

    actions.push({
      id: "remove",
      label: "Remove from Bin",
      Icon: Unarchive,
      color: "warning",
      run: () => deleteFromBin(entry.id),
    });

    return actions;
  }, [entry, live, dispatch, addToQueue, addToFlowsheet, deleteFromBin]);
}
