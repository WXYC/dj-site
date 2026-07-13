import type { PaletteRange } from "@mui/joy/styles";
import type {
  ExclusiveTokens,
  OnAirTokens,
  PaletteScale,
  RotationBinTokens,
} from "./types";

/**
 * Semantic palette slots layered on top of Joy's built-in palettes. These become
 * real CSS variables (`--wxyc-palette-<slot>-*`) via `extendTheme`.
 *
 * - `sidebar` / `sidebarAdmin` / `formatVinyl` / `formatCd` are full variant
 *   palettes (scale + variant tokens), so they work as a Joy `color=` prop
 *   (incl. `invertedColors`).
 * - `exclusive` / `onAir` / `rotation` are custom-shaped token groups consumed
 *   directly via `theme.vars.palette.*`.
 */
declare module "@mui/joy/styles" {
  interface Palette {
    sidebar: PaletteRange;
    sidebarAdmin: PaletteRange;
    formatVinyl: PaletteRange;
    formatCd: PaletteRange;
    exclusive: {
      solidBg: string;
      solidHoverBg: string;
      solidColor: string;
    };
    onAir: {
      indicator: string;
      glow: string;
    };
    rotation: {
      heavy: RotationBinTokens;
      medium: RotationBinTokens;
      light: RotationBinTokens;
      singles: RotationBinTokens;
    };
  }
}

/** Allow the full-scale semantic slots as `color=` props on the components that use them. */
declare module "@mui/joy/Sheet" {
  interface SheetPropsColorOverrides {
    sidebar: true;
    sidebarAdmin: true;
  }
}
declare module "@mui/joy/Chip" {
  interface ChipPropsColorOverrides {
    formatVinyl: true;
    formatCd: true;
  }
}

/** Neutral-based disabled tokens reference the theme's neutral scale (mirrors Joy). */
const neutralVar = (index: number) => `var(--wxyc-palette-neutral-${index})`;

/**
 * Expand a bare 50-900 scale into a full Joy variant palette by generating the
 * per-variant tokens (`solidBg`, `softBg`, …) using Joy's own default formula
 * (see `node_modules/@mui/joy/styles/extendTheme.js`). Without these tokens Joy
 * will not emit `theme.variants.{solid,soft,…}.<slot>`, so the slot could not be
 * used as a `color=` prop.
 */
export function createVariantPalette(
  scale: PaletteScale,
  mode: "light" | "dark"
): PaletteRange {
  const s = scale;
  const light = {
    plainColor: s[500],
    plainHoverBg: s[100],
    plainActiveBg: s[200],
    plainDisabledColor: neutralVar(400),
    outlinedColor: s[500],
    outlinedBorder: s[300],
    outlinedHoverBg: s[100],
    outlinedActiveBg: s[200],
    outlinedDisabledColor: neutralVar(400),
    outlinedDisabledBorder: neutralVar(200),
    softColor: s[700],
    softBg: s[100],
    softHoverBg: s[200],
    softActiveColor: s[800],
    softActiveBg: s[300],
    softDisabledColor: neutralVar(400),
    softDisabledBg: neutralVar(50),
    solidColor: "#fff",
    solidBg: s[500],
    solidHoverBg: s[600],
    solidActiveBg: s[700],
    solidDisabledColor: neutralVar(400),
    solidDisabledBg: neutralVar(100),
  };
  const dark = {
    plainColor: s[300],
    plainHoverBg: s[800],
    plainActiveBg: s[700],
    plainDisabledColor: neutralVar(500),
    outlinedColor: s[200],
    outlinedBorder: s[700],
    outlinedHoverBg: s[800],
    outlinedActiveBg: s[700],
    outlinedDisabledColor: neutralVar(500),
    outlinedDisabledBorder: neutralVar(800),
    softColor: s[200],
    softBg: s[800],
    softHoverBg: s[700],
    softActiveColor: s[100],
    softActiveBg: s[600],
    softDisabledColor: neutralVar(500),
    softDisabledBg: neutralVar(800),
    solidColor: "#fff",
    solidBg: s[500],
    solidHoverBg: s[600],
    solidActiveBg: s[700],
    solidDisabledColor: neutralVar(500),
    solidDisabledBg: neutralVar(800),
  };
  return { ...s, ...(mode === "dark" ? dark : light) } as unknown as PaletteRange;
}

/** Re-exported for definitions that want to build token groups inline. */
export type { ExclusiveTokens, OnAirTokens, RotationBinTokens };
