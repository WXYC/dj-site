import type { PaletteScale, ThemeDefinition } from "../types";

/**
 * The default WXYC modern theme. Its built-in palettes (primary/success/
 * warning/danger) reproduce the historical `modernTheme` exactly, so migrating to
 * the token system is a no-op for those. Semantic slots are seeded with the
 * values that were previously hardcoded across components:
 *   - sidebar         → the old primary scale (sidebar used `color="primary"`)
 *   - sidebarAdmin    → the old success scale (admin sidebar used `color="success"`)
 *   - exclusive       → the old EXCLUSIVES_PURPLE constant
 *   - onAir           → the old hardcoded #ef4444 live dot + glow
 *   - rotation        → the old rotation-bin hex tables
 * Formats get dedicated hues (amber = vinyl, sky = CD) per the design decision to
 * decouple them from primary/warning.
 */

// --- built-in scales (verbatim from the historical modernTheme) ---
const PRIMARY_LIGHT: PaletteScale = {
  50: "#fff1f2",
  100: "#ffe4e6",
  200: "#fecdd3",
  300: "#fda4af",
  400: "#fb7185",
  500: "#f43f5e",
  600: "#e11d48",
  700: "#be123c",
  800: "#9f1239",
  900: "#881337",
};
const SUCCESS_LIGHT: PaletteScale = {
  50: "#e0f2f1",
  100: "#b2dfdb",
  200: "#80cbc4",
  300: "#4db6ac",
  400: "#26a69a",
  500: "#009688",
  600: "#00897b",
  700: "#00796b",
  800: "#00695c",
  900: "#004d40",
};
const WARNING_LIGHT: PaletteScale = {
  50: "#fafaf9",
  100: "#f5f5f4",
  200: "#e7e5e4",
  300: "#d6d3d1",
  400: "#a8a29e",
  500: "#78716c",
  600: "#57534e",
  700: "#44403c",
  800: "#292524",
  900: "#1c1917",
};
const DANGER_LIGHT: PaletteScale = {
  50: "#fdf4ff",
  100: "#fae8ff",
  200: "#f5d0fe",
  300: "#f0abfc",
  400: "#e879f9",
  500: "#d946ef",
  600: "#c026d3",
  700: "#a21caf",
  800: "#86198f",
  900: "#701a75",
};
const PRIMARY_DARK: PaletteScale = {
  50: "#faeaef",
  100: "#ecadc0",
  200: "#e383a0",
  300: "#d95a81",
  400: "#d03161",
  500: "#a6274e",
  600: "#922244",
  700: "#531427",
  800: "#3e0f1d",
  900: "#15050a",
};
const DANGER_DARK: PaletteScale = {
  50: "#eef2ff",
  100: "#e0e7ff",
  200: "#c7d2fe",
  300: "#a5b4fc",
  400: "#818cf8",
  500: "#6366f1",
  600: "#4f46e5",
  700: "#4338ca",
  800: "#3730a3",
  900: "#312e81",
};
const SUCCESS_DARK: PaletteScale = {
  50: "#e8f3f4",
  100: "#b9dcdf",
  200: "#74b9bf",
  300: "#45a1a9",
  400: "#178a94",
  500: "#126e76",
  600: "#106168",
  700: "#0c454a",
  800: "#07292c",
  900: "#051c1e",
};

// --- dedicated format hues (amber = vinyl, sky = CD) ---
const AMBER: PaletteScale = {
  50: "#fffbeb",
  100: "#fef3c7",
  200: "#fde68a",
  300: "#fcd34d",
  400: "#fbbf24",
  500: "#f59e0b",
  600: "#d97706",
  700: "#b45309",
  800: "#92400e",
  900: "#78350f",
};
const SKY: PaletteScale = {
  50: "#f0f9ff",
  100: "#e0f2fe",
  200: "#bae6fd",
  300: "#7dd3fc",
  400: "#38bdf8",
  500: "#0ea5e9",
  600: "#0284c7",
  700: "#0369a1",
  800: "#075985",
  900: "#0c4a6e",
};

const EXCLUSIVE = { solidBg: "#7B2D8E", solidHoverBg: "#6a2479", solidColor: "#fff" };
const ON_AIR = { indicator: "#ef4444", glow: "rgba(239, 68, 68, 0.5)" };

const ROTATION_LIGHT = {
  heavy: { bg: "#fce4ec", bgHover: "#f8bbd0", bgSelected: "#e53935", text: "#b71c1c", textSelected: "#fff", border: "#ef9a9a" },
  medium: { bg: "#fff9c4", bgHover: "#fff176", bgSelected: "#f9a825", text: "#f57f17", textSelected: "#fff", border: "#fdd835" },
  light: { bg: "#e0f2f1", bgHover: "#b2dfdb", bgSelected: "#00897b", text: "#004d40", textSelected: "#fff", border: "#80cbc4" },
  singles: { bg: "#e8eaf6", bgHover: "#c5cae9", bgSelected: "#5c6bc0", text: "#283593", textSelected: "#fff", border: "#9fa8da" },
};
const ROTATION_DARK = {
  heavy: { bg: "#4a1a1a", bgHover: "#5c2020", bgSelected: "#e53935", text: "#ef9a9a", textSelected: "#fff", border: "#7f3333" },
  medium: { bg: "#4a3a0a", bgHover: "#5c4810", bgSelected: "#f9a825", text: "#fdd835", textSelected: "#fff", border: "#7f6820" },
  light: { bg: "#1a3a36", bgHover: "#204a44", bgSelected: "#00897b", text: "#80cbc4", textSelected: "#fff", border: "#336a60" },
  singles: { bg: "#262a4a", bgHover: "#30365c", bgSelected: "#5c6bc0", text: "#9fa8da", textSelected: "#fff", border: "#4a5090" },
};

export const defaultTheme: ThemeDefinition = {
  id: "default",
  label: "WXYC Rose",
  description: "The signature WXYC look — rose, teal, and stone.",
  schemes: {
    light: {
      primary: PRIMARY_LIGHT,
      success: SUCCESS_LIGHT,
      warning: WARNING_LIGHT,
      danger: DANGER_LIGHT,
      sidebar: PRIMARY_LIGHT,
      sidebarAdmin: SUCCESS_LIGHT,
      formatVinyl: AMBER,
      formatCd: SKY,
      exclusive: EXCLUSIVE,
      onAir: ON_AIR,
      rotation: ROTATION_LIGHT,
    },
    dark: {
      primary: PRIMARY_DARK,
      danger: DANGER_DARK,
      success: SUCCESS_DARK,
      sidebar: PRIMARY_DARK,
      sidebarAdmin: SUCCESS_DARK,
      formatVinyl: AMBER,
      formatCd: SKY,
      exclusive: EXCLUSIVE,
      onAir: ON_AIR,
      rotation: ROTATION_DARK,
    },
  },
};

export default defaultTheme;
