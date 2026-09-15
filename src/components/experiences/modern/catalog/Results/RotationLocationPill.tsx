"use client";

import Chip from "@mui/joy/Chip";
import type { RotationLocation } from "@/lib/features/rotation/location";
import { RotationCardBadge } from "@/src/components/shared/RotationCardBadge";

/**
 * A rotating release's physical location (bin + card), rendered as a pill
 * visually distinct from the call number it replaces. The chrome is the
 * signal: without it, a DJ scanning a mixed result list reads `H · card 2`
 * under the Call # header as an unfamiliar call-number format and walks to
 * the stacks anyway — the outcome the location swap exists to prevent.
 *
 * The card number rides in a circular badge; the card's optional name travels
 * only in the pill's own `title`, so the tooltip can never hang over
 * neighboring metadata and mislabel it. The badge is decorative — the whole
 * "…rotation, card N" reading stays in that `title`.
 */
export function RotationLocationPill({
  location,
}: {
  location: RotationLocation;
}) {
  return (
    <Chip
      variant="soft"
      color="primary"
      size="sm"
      title={location.title}
      sx={{
        border: "1px solid",
        borderColor: "primary.outlinedBorder",
        fontWeight: "xl",
        whiteSpace: "nowrap",
        cursor: "default",
      }}
    >
      {location.cardNumber != null ? (
        <>
          {location.bin} <RotationCardBadge number={location.cardNumber} bin={location.bin} />
        </>
      ) : (
        location.bin
      )}
    </Chip>
  );
}
