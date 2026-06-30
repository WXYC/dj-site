"use client";

import { Rotation } from "@/lib/features/rotation/types";
import {
  getRotationBinColors,
  ROTATION_BINS,
} from "@/src/utilities/modern/rotationBinColors";
import { Box, Stack, useColorScheme } from "@mui/joy";

export default function RotationBinSelector({
  selectedBin,
  onSelectBin,
  disabled,
}: {
  selectedBin: Rotation | null;
  onSelectBin: (bin: Rotation) => void;
  disabled: boolean;
}) {
  const { mode } = useColorScheme();
  const colors = getRotationBinColors(mode);

  return (
    <Stack
      direction="row"
      role="radiogroup"
      aria-label="Rotation bin"
      spacing={1}
      sx={{ alignItems: "center", mx: 1 }}
    >
      {ROTATION_BINS.map((bin) => {
        const isSelected = selectedBin === bin;
        const c = colors[bin];
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
