// WXYC brand colors shared across the modern flowsheet views.

// "Exclusive" purple — flags a release that isn't available on streaming.
// Resolves to the active theme's `exclusive` palette slot (see
// lib/features/experiences/modern/themes) so it retheme-s with the color
// system; the hex fallback keeps it sane if the var is ever absent.
export const WXYC_EXCLUSIVE_PURPLE =
  "var(--wxyc-palette-exclusive-solidBg, #7B2D8E)";
