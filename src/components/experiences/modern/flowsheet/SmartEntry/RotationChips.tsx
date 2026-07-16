"use client";

import { Box } from "@mui/joy";
import type { MouseEvent } from "react";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
} from "@/src/utilities/modern/rotationBinColors";
import type { Rotation } from "@/lib/features/rotation/types";
import { rotationSurfaceSx } from "./rotationChipStyle";

/**
 * The rotation "takeover" buttons — H / M / L / S — that sit at the end of the
 * inline affordance. Unlike the trigger chips they don't splice text and aren't
 * part of the Tab cycle: each opens the results pane onto *everything* in that
 * rotation bin, moving the DJ into a rotation-only browse without typing.
 *
 * Each shows its letter at rest and expands rightward to reveal the rest of the
 * bin's name on hover (H → Heavy). Colours come from the theme's per-bin
 * rotation palette so they retheme with the color system. Pointer/touch
 * affordances (`tabIndex={-1}`), like the trigger chips.
 */
export default function RotationChips({
  onTakeover,
}: {
  onTakeover: (bin: Rotation) => void;
}) {
  return (
    <Box
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.375 }}
      data-testid="flowsheet-rotation-chips"
    >
      {ROTATION_BINS.map((bin) => {
        const label = ROTATION_BIN_LABELS[bin]; // e.g. "Heavy"
        return (
          <Box
            component="button"
            type="button"
            key={bin}
            tabIndex={-1}
            aria-label={`Browse ${label} rotation`}
            data-testid={`flowsheet-rotation-${bin}`}
            // preventDefault keeps the composer focused so the pane anchors to
            // it and the caret survives; the takeover runs on click.
            onMouseDown={(e: MouseEvent) => e.preventDefault()}
            onClick={() => onTakeover(bin)}
            sx={{
              ...rotationSurfaceSx(bin),
              display: "inline-flex",
              alignItems: "center",
              height: "1.375rem",
              px: "0.3rem",
              border: "1px solid",
              borderRadius: "sm",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: "0.72rem",
              lineHeight: 1,
              letterSpacing: "0.02em",
              transition: "background-color 0.15s ease",
              // The remainder of the bin name collapses at rest and slides open
              // on hover: "H" → "H" + "eavy".
              "& .rot-rest": {
                display: "inline-block",
                maxWidth: 0,
                overflow: "hidden",
                whiteSpace: "nowrap",
                opacity: 0,
                transition: "max-width 0.18s ease, opacity 0.18s ease",
              },
              "&:hover .rot-rest": { maxWidth: "4rem", opacity: 1 },
              "@media (prefers-reduced-motion: reduce)": {
                transition: "none",
                "& .rot-rest": { transition: "none" },
              },
            }}
          >
            <span>{label[0]}</span>
            <span className="rot-rest">{label.slice(1)}</span>
          </Box>
        );
      })}
    </Box>
  );
}
