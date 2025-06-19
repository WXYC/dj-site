"use client";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { Chip, MenuItem, Typography } from "@mui/joy";

import { convertBinToQueue } from "@/lib/features/bin/conversions";
import { useShiftKey } from "@/src/hooks/applicationHooks";
import { useDeleteFromBin } from "@/src/hooks/binHooks";
import { useQueue } from "@/src/hooks/flowsheetHooks";
import PlaylistAdd from "@mui/icons-material/PlaylistAdd";

export default function AddToQueueFromBin({ entry }: { entry: AlbumEntry }) {
  const shiftKeyPressed = useShiftKey();

  const { addToQueue } = useQueue();
  const { deleteFromBin } = useDeleteFromBin();

  return (
    <MenuItem
      color="success"
      onClick={() => {
        if (shiftKeyPressed) {
          deleteFromBin(entry.id);
        }

        addToQueue(convertBinToQueue(entry));
      }}
    >
      <PlaylistAdd />
      Add to Queue
      <Chip
        size="sm"
        variant="outlined"
        sx={{
          color: shiftKeyPressed ? "CaptionText" : "neutral.400",
        }}
      >
        + Shift
      </Chip>{" "}
      <Typography
        level="body-xxs"
        sx={{
          color: shiftKeyPressed ? "CaptionText" : "neutral.400",
        }}
      >
        to remove from bin
      </Typography>
    </MenuItem>
  );
}
