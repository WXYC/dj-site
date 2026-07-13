import type { Rotation } from "@/lib/features/rotation/types";

/** Bin code → the theme's per-bin rotation palette slot. */
export const BIN_PALETTE_KEY: Record<
  Rotation,
  "heavy" | "medium" | "light" | "singles"
> = {
  H: "heavy",
  M: "medium",
  L: "light",
  S: "singles",
};

/**
 * The per-bin rotation colours live in the theme's `rotation` palette slot,
 * exposed as CSS vars (cssVarPrefix "wxyc"). Reference them directly rather than
 * through `theme.vars.palette.rotation` — the raw var resolves wherever the slot
 * is defined (the modern experience) and degrades to a neutral fallback
 * elsewhere, without a hard dependency that would blow up if the slot is absent.
 */
export const rotVar = (key: string, token: string, fallback: string): string =>
  `var(--wxyc-palette-rotation-${key}-${token}, ${fallback})`;

/** Rotation-coloured surface (bg / text / border / hover) for a bin chip. */
export function rotationSurfaceSx(bin: Rotation) {
  const key = BIN_PALETTE_KEY[bin];
  return {
    color: rotVar(key, "text", "var(--wxyc-palette-neutral-softColor)"),
    bgcolor: rotVar(key, "bg", "var(--wxyc-palette-neutral-softBg)"),
    borderColor: rotVar(
      key,
      "border",
      "var(--wxyc-palette-neutral-outlinedBorder)"
    ),
    "&:hover": {
      bgcolor: rotVar(key, "bgHover", "var(--wxyc-palette-neutral-softHoverBg)"),
    },
  };
}
