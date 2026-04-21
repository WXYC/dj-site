"use client";

import { Rotation } from "@/lib/features/rotation/types";
import { Box, Stack, useColorScheme } from "@mui/joy";

const BINS: Rotation[] = [Rotation.H, Rotation.M, Rotation.L, Rotation.S];

type BinColorSet = { bg: string; bgSelected: string; bgHover: string; text: string; textSelected: string; border: string };

const LIGHT_COLORS: Record<Rotation, BinColorSet> = {
  H: { bg: "#fce4ec", bgSelected: "#e53935", bgHover: "#f8bbd0", text: "#b71c1c", textSelected: "#fff", border: "#ef9a9a" },
  M: { bg: "#fff9c4", bgSelected: "#f9a825", bgHover: "#fff176", text: "#f57f17", textSelected: "#fff", border: "#fdd835" },
  L: { bg: "#e0f2f1", bgSelected: "#00897b", bgHover: "#b2dfdb", text: "#004d40", textSelected: "#fff", border: "#80cbc4" },
  S: { bg: "#e8eaf6", bgSelected: "#5c6bc0", bgHover: "#c5cae9", text: "#283593", textSelected: "#fff", border: "#9fa8da" },
};

const DARK_COLORS: Record<Rotation, BinColorSet> = {
  H: { bg: "#4a1a1a", bgSelected: "#e53935", bgHover: "#5c2020", text: "#ef9a9a", textSelected: "#fff", border: "#7f3333" },
  M: { bg: "#4a3a0a", bgSelected: "#f9a825", bgHover: "#5c4810", text: "#fdd835", textSelected: "#fff", border: "#7f6820" },
  L: { bg: "#1a3a36", bgSelected: "#00897b", bgHover: "#204a44", text: "#80cbc4", textSelected: "#fff", border: "#336a60" },
  S: { bg: "#262a4a", bgSelected: "#5c6bc0", bgHover: "#30365c", text: "#9fa8da", textSelected: "#fff", border: "#4a5090" },
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
  const { mode } = useColorScheme();
  const colors = mode === "dark" ? DARK_COLORS : LIGHT_COLORS;

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
