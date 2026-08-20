"use client";

import type { Rotation } from "@/lib/features/rotation/types";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
} from "@/src/utilities/modern/rotationBinColors";
import { Checkbox, Stack, Typography } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

// Bin letter → the theme's `rotation` palette slot. Colors come from the
// active theme's CSS vars (light and dark both), so the picker rethemes with
// the rest of the color system instead of carrying its own hex tables.
const BIN_SLOT: Record<Rotation, "heavy" | "medium" | "light" | "singles"> = {
  H: "heavy",
  M: "medium",
  L: "light",
  S: "singles",
};

/**
 * Single-select rotation-bin chips that behave like a radiogroup but allow
 * deselection: toggling the selected bin clears it, which a plain radio
 * cannot express.
 */
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
      {/* A group of toggleable checkboxes, not a radiogroup: the selected
          bin can be clicked again to clear it, which radio semantics can't
          express. Single-select is enforced by the controlled value. */}
      <Stack
        direction="row"
        role="group"
        aria-label="Rotation bin"
        spacing={size === "sm" ? 0.75 : 1}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        {ROTATION_BINS.map((bin) => {
          const isSelected = selectedBin === bin;
          const c = theme.vars.palette.rotation[BIN_SLOT[bin]];
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
                    bgcolor: isSelected ? c.bgSelected : c.bg,
                    borderColor: isSelected ? "transparent" : c.border,
                    color: isSelected ? c.textSelected : c.text,
                    "&:hover": {
                      bgcolor: isSelected ? c.bgSelected : c.bgHover,
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
