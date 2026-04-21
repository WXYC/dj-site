"use client";

import { Rotation } from "@/lib/features/rotation/types";
import { RotationStyles } from "@/src/utilities/modern/rotationstyles";
import { Box, Stack, useTheme } from "@mui/joy";

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
      spacing={0.5}
      role="radiogroup"
      aria-label="Rotation bin"
      sx={{ alignItems: "center", px: 0.5 }}
    >
      {BINS.map((bin) => {
        const isSelected = selectedBin === bin;
        const color = RotationStyles[bin];
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
              backgroundColor: isSelected
                ? `var(--joy-palette-${color}-500, ${theme.palette[color][500]})`
                : `var(--joy-palette-${color}-100, ${theme.palette[color][100]})`,
              color: isSelected
                ? `var(--joy-palette-${color}-50, #fff)`
                : `var(--joy-palette-${color}-700, ${theme.palette[color][700]})`,
              opacity: disabled ? 0.5 : 1,
              "&:hover:not(:disabled)": {
                backgroundColor: isSelected
                  ? `var(--joy-palette-${color}-600, ${theme.palette[color][600]})`
                  : `var(--joy-palette-${color}-200, ${theme.palette[color][200]})`,
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
