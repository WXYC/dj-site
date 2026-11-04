"use client";

import Chip from "@mui/joy/Chip";
import Tooltip from "@mui/joy/Tooltip";
import { rotationBinSx } from "@/lib/features/experiences/modern/tokens/roles";
import type { RotationLocation } from "@/lib/features/rotation/location";
import { RotationCardBadge } from "@/src/components/shared/RotationCardBadge";

/**
 * A rotating release's physical location (bin + card), rendered as a pill
 * visually distinct from the call number it replaces. The chrome is the
 * signal: without it, a DJ scanning a mixed result list reads `H · card 2`
 * under the Call # header as an unfamiliar call-number format and walks to
 * the stacks anyway — the outcome the location swap exists to prevent.
 *
 * Painted in the bin's own colors, so the letter and the card badge inside
 * it can never disagree in hue. The card's optional name travels only in the
 * pill's tooltip, so it can never hang over neighboring metadata and mislabel
 * it. The badge is decorative — the whole "…rotation, card N" reading is the
 * pill's accessible name.
 */
export function RotationLocationPill({
  location,
}: {
  location: RotationLocation;
}) {
  return (
    <Tooltip variant="outlined" size="sm" title={location.title} enterDelay={400}>
      <Chip
        variant="soft"
        size="sm"
        // Focusable so the tooltip carrying the card's name opens from the
        // keyboard too; the title is also the accessible name, since the
        // card badge inside is decorative.
        tabIndex={0}
        aria-label={location.title}
        sx={{
          ...rotationBinSx(location.bin, "soft"),
          "&:hover": {},
          fontWeight: "xl",
          whiteSpace: "nowrap",
          cursor: "default",
          // With a card, the badge rides flush against the pill's right end
          // like a slider's knob: the pill keeps its left padding only and
          // hugs the badge (at its usual size) with a hairline inset.
          ...(location.cardNumber != null && {
            "--Chip-paddingInline": "0px",
            pl: "0.65em",
            pr: "2px",
            py: "2px",
          }),
        }}
      >
        {location.cardNumber != null ? (
          <>
            {location.bin}
            <RotationCardBadge
              number={location.cardNumber}
              bin={location.bin}
              sx={{ ml: "0.45em" }}
            />
          </>
        ) : (
          location.bin
        )}
      </Chip>
    </Tooltip>
  );
}
