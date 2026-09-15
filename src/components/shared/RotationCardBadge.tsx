"use client";

import Box from "@mui/joy/Box";
import { useTheme } from "@mui/joy/styles";
import type { Rotation } from "@/lib/features/rotation/types";
import { ROTATION_BIN_PALETTE_SLOT } from "@/src/utilities/modern/rotationBinColors";

/**
 * A rotation card number in a small circular badge — the visual half of a card
 * location, the "②" in "② Jazz".
 *
 * A CSS circle, never a Unicode circled-digit glyph (①–⑳): those glyphs stop
 * at 20 and render inconsistently across fonts, so any card past 20 would be
 * unrepresentable. This sizes to the digits it holds — a circle for a single
 * digit, widening for more — so every card number renders.
 *
 * Filled in its bin's color (`bin` → the theme's `rotation` palette slot), the
 * same hue the bin letters carry, so a card reads as belonging to its bin at a
 * glance and rethemes with the color system.
 *
 * Purely decorative: `aria-hidden`, carrying no accessible text of its own, so
 * a screen reader never reads a bare number out of context. The surrounding
 * element owns the readable name — a `title` or label that already spells out
 * "card N".
 *
 * Carries no spacing of its own. A caller that follows the badge with a card
 * name owns the gap between them (a margin on the name, which — unlike a text
 * space — survives a flex value container); a caller that places the badge at
 * the end of a line gets no stray trailing space.
 */
export function RotationCardBadge({ number, bin }: { number: number; bin: Rotation }) {
  const tokens = useTheme().vars.palette.rotation[ROTATION_BIN_PALETTE_SLOT[bin]];
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "1.6em",
        height: "1.6em",
        px: "0.4em",
        borderRadius: "50%",
        bgcolor: tokens.bgSelected,
        color: tokens.textSelected,
        fontWeight: "xl",
        lineHeight: 1,
        verticalAlign: "middle",
      }}
    >
      {number}
    </Box>
  );
}
