"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { AlbumEntry } from "@/lib/features/catalog/types";
import {
  convertBinToFlowsheet,
  convertBinToQueue,
} from "@/lib/features/bin/conversions";
import { useAppDispatch } from "@/lib/hooks";
import { useDeleteFromBin } from "@/src/hooks/binHooks";
import { useFlowsheet, useQueue } from "@/src/hooks/flowsheetHooks";
import {
  DeleteOutline,
  InfoOutlined,
  PlayArrowOutlined,
  PlaylistAdd,
} from "@mui/icons-material";
import { ColorPaletteProp } from "@mui/joy";
import { useMemo } from "react";
import { toast } from "sonner";

export type BinEntryAction = {
  id: string;
  label: string;
  Icon: React.ElementType;
  color: ColorPaletteProp;
  run: () => void;
};

/**
 * The action set for a single Mail Bin entry, shared by the hover icon buttons
 * and the right-click context menu so both stay in sync. Queue / Play only
 * appear while a show is live. No keyboard-shortcut affordances.
 */
export function useBinEntryActions(
  entry: AlbumEntry,
  live: boolean,
): BinEntryAction[] {
  const dispatch = useAppDispatch();
  const { addToQueue } = useQueue();
  const { addToFlowsheet } = useFlowsheet();
  const { deleteFromBin } = useDeleteFromBin();

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
        run: () => {
          addToQueue(convertBinToQueue(entry));
          toast.success(`Added ${entry.title} to queue`);
        },
      });
      actions.push({
        id: "play",
        label: "Play Now",
        Icon: PlayArrowOutlined,
        color: "primary",
        run: () => addToFlowsheet(convertBinToFlowsheet(entry)),
      });
    }

    actions.push({
      id: "remove",
      label: "Remove from Bin",
      Icon: DeleteOutline,
      color: "warning",
      run: () => deleteFromBin(entry.id),
    });

    return actions;
  }, [entry, live, dispatch, addToQueue, addToFlowsheet, deleteFromBin]);
}
