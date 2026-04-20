"use client";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { Chip, MenuItem, Typography } from "@mui/joy";
import { useShiftKey } from "@/src/hooks/applicationHooks";
import { useDeleteFromBin } from "@/src/hooks/binHooks";
import { type ColorPaletteProp } from "@mui/joy";

export default function BinActionMenuItem({
  entry,
  icon,
  label,
  color,
  onAction,
}: {
  entry: AlbumEntry;
  icon: React.ReactNode;
  label: string;
  color: ColorPaletteProp;
  onAction: (entry: AlbumEntry) => void;
}) {
  const shiftKeyPressed = useShiftKey();
  const { deleteFromBin } = useDeleteFromBin();

  return (
    <MenuItem
      color={color}
      onClick={() => {
        if (shiftKeyPressed) {
          deleteFromBin(entry.id);
        }
        onAction(entry);
      }}
    >
      {icon}
      {label}
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
