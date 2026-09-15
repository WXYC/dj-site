"use client";

import Box from "@mui/joy/Box";

/**
 * A rotation card number in a small circular badge — the visual half of a card
 * location, the "②" in "② Jazz".
 *
 * A CSS circle, never a Unicode circled-digit glyph (①–⑳): those glyphs stop
 * at 20 and render inconsistently across fonts, so any card past 20 would be
 * unrepresentable. This sizes to the digits it holds — a circle for a single
 * digit, widening for more — so every card number renders.
 *
 * Purely decorative: `aria-hidden`, carrying no accessible text of its own, so
 * a screen reader never reads a bare number out of context. The surrounding
 * element owns the readable name — a `title` or label that already spells out
 * "card N".
 */
export function RotationCardBadge({ number }: { number: number }) {
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
        bgcolor: "primary.solidBg",
        color: "primary.solidColor",
        fontWeight: "xl",
        lineHeight: 1,
        verticalAlign: "middle",
        // Own the gap to the name: a text space collapses against the badge
        // inside a flex value container (e.g. the card Select), so it can't be
        // relied on. Harmless when the badge stands alone.
        marginInlineEnd: "0.6em",
      }}
    >
      {number}
    </Box>
  );
}
