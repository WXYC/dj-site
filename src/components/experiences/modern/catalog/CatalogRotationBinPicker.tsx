"use client";

import type { Rotation } from "@/lib/features/rotation/types";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  ROTATION_BIN_PALETTE_SLOT,
  rotationBinSurfaceStyle,
} from "@/src/utilities/modern/rotationBinColors";
import { Checkbox, Stack, Typography } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

// Single-select bin chips; clicking the selected bin again clears it, which plain radios can't express.
export default function CatalogRotationBinPicker({
  selectedBin,
  onSelectBin,
  disabled = false,
  size = "md",
  showLabel = true,
}: {
  selectedBin: Rotation | null;
  onSelectBin: (bin: Rotation | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const theme = useTheme();

  const handleToggle = (bin: Rotation) => {
    if (disabled) return;
    onSelectBin(selectedBin === bin ? null : bin);
  };

  return (
    <Stack spacing={showLabel ? 0.75 : 0}>
      {showLabel ? (
        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
          Rotation bin
        </Typography>
      ) : null}
      <Stack
        direction="row"
        role="group"
        aria-label="Rotation bin"
        spacing={size === "sm" ? 0.75 : 1}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        {ROTATION_BINS.map((bin) => {
          const isSelected = selectedBin === bin;
          const tokens =
            theme.vars.palette.rotation[ROTATION_BIN_PALETTE_SLOT[bin]];
          const surface = rotationBinSurfaceStyle(tokens, isSelected);
          return (
            <Checkbox
              key={bin}
              size={size}
              variant="solid"
              checked={isSelected}
              disabled={disabled}
              onClick={() => handleToggle(bin)}
              label={bin}
              slotProps={{
                input: { "aria-label": `${ROTATION_BIN_LABELS[bin]} rotation` },
                label: {
                  sx: {
                    fontWeight: isSelected ? "lg" : "md",
                    fontSize: size === "sm" ? "0.75rem" : "0.8125rem",
                  },
                },
                checkbox: {
                  sx: {
                    bgcolor: surface.backgroundColor,
                    borderColor: surface.borderColor,
                    color: surface.color,
                    "&:hover": {
                      bgcolor: surface.hoverBackgroundColor,
                    },
                  },
                },
              }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
