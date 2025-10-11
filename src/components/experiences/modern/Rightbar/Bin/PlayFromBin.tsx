"use client";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { Chip, MenuItem, Typography } from "@mui/joy";

import { convertBinToFlowsheet } from "@/lib/features/bin/conversions";
import { useShiftKey } from "@/src/hooks/applicationHooks";
import { useDeleteFromBin } from "@/src/hooks/binHooks";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { PlayArrowOutlined } from "@mui/icons-material";

export default function PlayFromBin({ entry }: { entry: AlbumEntry }) {
  const shiftKeyPressed = useShiftKey();

  const { addToFlowsheet } = useFlowsheet();
  const { deleteFromBin } = useDeleteFromBin();

  return (
    <MenuItem
      color="primary"
      onClick={() => {
        if (shiftKeyPressed) {
          deleteFromBin(entry.id);
        }

        addToFlowsheet(convertBinToFlowsheet(entry));
      }}
    >
      <PlayArrowOutlined />
      Play Now
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
