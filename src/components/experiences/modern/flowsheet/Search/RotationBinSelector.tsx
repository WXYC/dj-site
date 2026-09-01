"use client";

import { Rotation } from "@/lib/features/rotation/types";
import {
  ROTATION_BIN_PALETTE_SLOT,
  rotationBinSurfaceStyle,
} from "@/src/utilities/modern/rotationBinColors";
import { Box, Stack } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

const BINS: Rotation[] = [Rotation.H, Rotation.M, Rotation.L, Rotation.S];

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
        const tokens = theme.vars.palette.rotation[ROTATION_BIN_PALETTE_SLOT[bin]];
        const style = rotationBinSurfaceStyle(tokens, isSelected);
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
              backgroundColor: style.backgroundColor,
              color: style.color,
              border: "1px solid",
              borderColor: style.borderColor,
              opacity: disabled ? 0.5 : 1,
              "&:hover:not(:disabled)": {
                backgroundColor: style.hoverBackgroundColor,
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
