"use client";

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
  MISSING_ARTIST_BIN_PLAY_MESSAGE,
  queueAdditionMessage,
  releaseCreditIsRefused,
  VARIOUS_ARTISTS_BIN_PLAY_MESSAGE,
} from "@/lib/features/flowsheet/various-artists-guard";
import {
  InfoOutlined,
  PlayArrowOutlined,
  PlaylistAdd,
  Unarchive,
} from "@mui/icons-material";
import { ColorPaletteProp } from "@mui/joy";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  return useMemo(() => {
    const actions: BinEntryAction[] = [
      {
        id: "info",
        label: "More information",
        Icon: InfoOutlined,
        color: "neutral",
        // Bin rows always carry a real library.id; only LML rows go null.
        run: () => router.push(`/dashboard/album/${entry.id}`),
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
          toast.success(queueAdditionMessage(entry));
          if (opts?.shiftKey) deleteFromBin(entry.id!);
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
            // at the escape hatch instead of just saying no. A release that
            // carries no credit and one whose credit is refused dead-end the
            // same way, but only the second involves a credit worth naming.
            toast.error(
              releaseCreditIsRefused(entry)
                ? VARIOUS_ARTISTS_BIN_PLAY_MESSAGE
                : MISSING_ARTIST_BIN_PLAY_MESSAGE
            );
            return;
          }
          addToFlowsheet(submission)
            // Only file the album away once it actually reached the
            // flowsheet — a failed play shouldn't also lose the bin entry.
            .then(() => {
              if (opts?.shiftKey) deleteFromBin(entry.id!);
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
      run: () => deleteFromBin(entry.id!),
    });

    return actions;
  }, [entry, live, router, addToQueue, addToFlowsheet, deleteFromBin]);
}
