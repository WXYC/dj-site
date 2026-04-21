"use client";

import { Rotation } from "@/lib/features/rotation/types";
import { Box, Stack } from "@mui/joy";

const BINS: Rotation[] = [Rotation.H, Rotation.M, Rotation.L, Rotation.S];

const BIN_COLORS: Record<Rotation, { bg: string; bgSelected: string; bgHover: string; text: string; textSelected: string; border: string }> = {
  H: { bg: "#fce4ec", bgSelected: "#e53935", bgHover: "#f8bbd0", text: "#b71c1c", textSelected: "#fff", border: "#ef9a9a" },
  M: { bg: "#fff9c4", bgSelected: "#f9a825", bgHover: "#fff176", text: "#f57f17", textSelected: "#fff", border: "#fdd835" },
  L: { bg: "#e0f2f1", bgSelected: "#00897b", bgHover: "#b2dfdb", text: "#004d40", textSelected: "#fff", border: "#80cbc4" },
  S: { bg: "#e8eaf6", bgSelected: "#5c6bc0", bgHover: "#c5cae9", text: "#283593", textSelected: "#fff", border: "#9fa8da" },
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
        const c = BIN_COLORS[bin];
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
