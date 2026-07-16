"use client";

import Close from "@mui/icons-material/Close";
import { Box } from "@mui/joy";
import type { Rotation } from "@/lib/features/rotation/types";
import { ROTATION_BIN_LABELS } from "@/src/utilities/modern/rotationBinColors";
import { rotationSurfaceSx } from "./rotationChipStyle";

/**
 * The "selected rotation mode" tag: once a rotation bin is chosen it sits next
 * to the song, rotation-coloured, showing the bin name and a ✕. Clicking it
 * exits rotation-selection mode (and clears the rotation filter). A real,
 * keyboard-reachable button — unlike the pointer-only chips — since it's the
 * one control that leaves the mode.
 */
export default function RotationTag({
  bin,
  onClear,
}: {
  bin: Rotation;
  onClear: () => void;
}) {
  const label = ROTATION_BIN_LABELS[bin];
  return (
    <Box
      component="button"
      type="button"
      aria-label={`Exit ${label} rotation`}
      data-testid="flowsheet-rotation-tag"
      onClick={onClear}
      sx={{
        ...rotationSurfaceSx(bin),
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        flexShrink: 0,
        height: "1.5rem",
        pl: 0.75,
        pr: 0.5,
        border: "1px solid",
        borderRadius: "sm",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: "0.72rem",
        lineHeight: 1,
        letterSpacing: "0.01em",
        transition: "background-color 0.15s ease",
      }}
    >
      <span>{label}</span>
      <Close sx={{ fontSize: "0.9rem" }} />
    </Box>
  );
}
