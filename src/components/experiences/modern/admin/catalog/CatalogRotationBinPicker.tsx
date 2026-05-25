"use client";

import type { Rotation } from "@/lib/features/rotation/types";
import {
  getRotationBinColors,
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
} from "@/src/utilities/modern/rotationBinColors";
import { Checkbox, Stack, Typography, useColorScheme } from "@mui/joy";

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
  const { mode } = useColorScheme();
  const colors = getRotationBinColors(mode);

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
        role="radiogroup"
        aria-label="Rotation bin"
        spacing={size === "sm" ? 0.75 : 1}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        {ROTATION_BINS.map((bin) => {
          const isSelected = selectedBin === bin;
          const c = colors[bin];
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
                label: {
                  sx: {
                    fontWeight: isSelected ? "lg" : "md",
                    fontSize: size === "sm" ? "0.75rem" : "0.8125rem",
                  },
                },
                checkbox: {
                  sx: {
                    bgcolor: isSelected ? c.bgSelected : c.bg,
                    borderColor: isSelected ? "transparent" : c.border,
                    color: isSelected ? c.textSelected : c.text,
                    "&:hover": {
                      bgcolor: isSelected ? c.bgSelected : c.bgHover,
                    },
                  },
                },
              }}
              aria-label={`${ROTATION_BIN_LABELS[bin]} rotation`}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
