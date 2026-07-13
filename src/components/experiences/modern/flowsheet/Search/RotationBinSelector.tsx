"use client";

import { Rotation } from "@/lib/features/rotation/types";
import { Box, Stack } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

const BINS: Rotation[] = [Rotation.H, Rotation.M, Rotation.L, Rotation.S];

// Bin letter → the theme's `rotation` palette slot. Colors come from the
// active theme's CSS vars (light and dark both), so the selector rethemes
// with the rest of the color system instead of carrying its own hex tables.
const BIN_SLOT: Record<Rotation, "heavy" | "medium" | "light" | "singles"> = {
  [Rotation.H]: "heavy",
  [Rotation.M]: "medium",
  [Rotation.L]: "light",
  [Rotation.S]: "singles",
};

export default function RotationBinSelector({
  selectedBin,
  onSelectBin,
  disabled,
}: {
  selectedBin: Rotation | null;
  onSelectBin: (bin: Rotation) => void;
  disabled: boolean;
}) {
  const theme = useTheme();

  return (
    <Stack
      direction="row"
      role="radiogroup"
      aria-label="Rotation bin"
      spacing={1}
      sx={{ alignItems: "center", mx: 1 }}
    >
      {BINS.map((bin) => {
        const isSelected = selectedBin === bin;
        const c = theme.vars.palette.rotation[BIN_SLOT[bin]];
        return (
          <Box
            key={bin}
            component="button"
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelectBin(bin)}
            sx={{
              all: "unset",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "26px",
              height: "22px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: isSelected ? "bold" : "normal",
              cursor: disabled ? "default" : "pointer",
              transition: "all 0.15s ease",
              backgroundColor: isSelected ? c.bgSelected : c.bg,
              color: isSelected ? c.textSelected : c.text,
              border: "1px solid",
              borderColor: isSelected ? "transparent" : c.border,
              opacity: disabled ? 0.5 : 1,
              "&:hover:not(:disabled)": {
                backgroundColor: isSelected ? c.bgSelected : c.bgHover,
              },
            }}
          >
            {bin}
          </Box>
        );
      })}
    </Stack>
  );
}
