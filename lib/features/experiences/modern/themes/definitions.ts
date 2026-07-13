import type {
  BackgroundTokens,
  ExclusiveTokens,
  OnAirTokens,
  PaletteScale,
  RotationBinTokens,
  ThemeDefinition,
} from "./types";

/**
 * All modern theme color definitions live in this one file (Tailwind-sourced
 * scales). Adding a theme = add a `ThemeDefinition` here and register it in
 * `./registry.ts`. Infrastructure (types, buildTheme, registry) stays separate;
 * only the colors live here.
 */

// ---------------------------------------------------------------------------
// Tailwind default scales (exact hex, 50–900)
// ---------------------------------------------------------------------------
const ROSE: PaletteScale = { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337" };
const ZINC: PaletteScale = { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b" };
const NEUTRAL: PaletteScale = { 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626", 900: "#171717" };
const EMERALD: PaletteScale = { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b" };
const AMBER: PaletteScale = { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f" };
const ORANGE: PaletteScale = { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 900: "#7c2d12" };
const RED: PaletteScale = { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b", 900: "#7f1d1d" };
const VIOLET: PaletteScale = { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95" };
const YELLOW: PaletteScale = { 50: "#fefce8", 100: "#fef9c3", 200: "#fef08a", 300: "#fde047", 400: "#facc15", 500: "#eab308", 600: "#ca8a04", 700: "#a16207", 800: "#854d0e", 900: "#713f12" };
const SKY: PaletteScale = { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e" };

// ---------------------------------------------------------------------------
// Shared tokens (kept constant across themes for brand/semantic recognition)
// ---------------------------------------------------------------------------
const EXCLUSIVE_LIGHT: ExclusiveTokens = { solidBg: "#7e22ce", solidHoverBg: "#6b21a8" }; // purple 700/800
const EXCLUSIVE_DARK: ExclusiveTokens = { solidBg: "#9333ea", solidHoverBg: "#a855f7" }; // purple 600/500
const ONAIR_LIGHT: OnAirTokens = { indicator: "#ef4444", glow: "rgba(239, 68, 68, 0.45)" };
const ONAIR_DARK: OnAirTokens = { indicator: "#f87171", glow: "rgba(248, 113, 113, 0.5)" };

// Soft warm-stone dark surfaces (replaces the dated near-black), shared app-wide.
const DARK_BACKGROUND: BackgroundTokens = { body: "#0c0a09", surface: "#1c1917", popup: "#292524", border: "#44403c" };

const rot = (
  bg: string, bgHover: string, bgSelected: string,
  text: string, textSelected: string, border: string
): RotationBinTokens => ({ bg, bgHover, bgSelected, text, textSelected, border });

// Rotation bins — mutually distinguishable, clear of the format/primary hues.
// heavy=hottest → singles=coolest.
const ROT_RED_L = rot("#fee2e2", "#fecaca", "#fca5a5", "#b91c1c", "#7f1d1d", "#fecaca");
const ROT_RED_D = rot("#450a0a", "#7f1d1d", "#991b1b", "#fca5a5", "#fee2e2", "#991b1b");
const ROT_TEAL_L = rot("#ccfbf1", "#99f6e4", "#5eead4", "#0f766e", "#134e4a", "#99f6e4");
const ROT_TEAL_D = rot("#042f2e", "#134e4a", "#115e59", "#5eead4", "#ccfbf1", "#115e59");
const ROT_YELLOW_L = rot("#fef9c3", "#fef08a", "#fde047", "#a16207", "#713f12", "#fef08a");
const ROT_YELLOW_D = rot("#422006", "#713f12", "#854d0e", "#fde047", "#fef9c3", "#854d0e");
const ROT_BLUE_L = rot("#dbeafe", "#bfdbfe", "#93c5fd", "#1d4ed8", "#1e3a8a", "#bfdbfe");
const ROT_BLUE_D = rot("#172554", "#1e3a8a", "#1e40af", "#93c5fd", "#dbeafe", "#1e40af");
const ROT_PINK_L = rot("#fce7f3", "#fbcfe8", "#f9a8d4", "#be185d", "#831843", "#fbcfe8");
const ROT_PINK_D = rot("#500724", "#831843", "#9d174d", "#f9a8d4", "#fce7f3", "#9d174d");
const ROT_INDIGO_L = rot("#e0e7ff", "#c7d2fe", "#a5b4fc", "#4338ca", "#312e81", "#c7d2fe");
const ROT_INDIGO_D = rot("#1e1b4b", "#312e81", "#3730a3", "#a5b4fc", "#e0e7ff", "#3730a3");

// ---------------------------------------------------------------------------
// WXYC Rose — flagship. Rose primary; zinc neutral + amber warning (kills the
// dated yellow-grey); orange/violet formats that harmonize with rose (Rock+CD
// no longer clash); soft warm-stone dark background.
// ---------------------------------------------------------------------------
export const wxycRoseTheme: ThemeDefinition = {
  id: "default",
  label: "WXYC Rose",
  description: "The signature WXYC look — soft rose, cool-zinc neutrals, warm accents.",
  schemes: {
    light: {
      primary: ROSE,
      neutral: ZINC,
      success: EMERALD,
      warning: AMBER,
      danger: RED,
      sidebar: ROSE,
      sidebarAdmin: EMERALD,
      formatVinyl: ORANGE,
      formatCd: VIOLET,
      exclusive: EXCLUSIVE_LIGHT,
      onAir: ONAIR_LIGHT,
      rotation: { heavy: ROT_RED_L, medium: ROT_YELLOW_L, light: ROT_TEAL_L, singles: ROT_BLUE_L },
      background: { body: "#fafaf9", surface: "#ffffff", popup: "#f5f5f4", border: "#e7e5e4" },
    },
    dark: {
      primary: ROSE,
      neutral: ZINC,
      success: EMERALD,
      warning: AMBER,
      danger: RED,
      sidebar: ROSE,
      sidebarAdmin: EMERALD,
      formatVinyl: ORANGE,
      formatCd: VIOLET,
      exclusive: EXCLUSIVE_DARK,
      onAir: ONAIR_DARK,
      rotation: { heavy: ROT_RED_D, medium: ROT_YELLOW_D, light: ROT_TEAL_D, singles: ROT_BLUE_D },
      background: DARK_BACKGROUND,
    },
  },
};

// ---------------------------------------------------------------------------
// Solar — a soft, sunny/warm theme. Amber primary (sunlight), yellow vinyl,
// muted sky CD ("golden hour" pairing), true-neutral scaffolding so the warm
// hues pop rather than blend into a gold wash.
// ---------------------------------------------------------------------------
export const solarTheme: ThemeDefinition = {
  id: "solar",
  label: "Solar",
  description: "Soft, sunny golds and ambers — warm but legible.",
  schemes: {
    light: {
      primary: AMBER,
      neutral: NEUTRAL,
      success: EMERALD,
      warning: ORANGE,
      danger: RED,
      sidebar: AMBER,
      sidebarAdmin: EMERALD,
      formatVinyl: YELLOW,
      formatCd: SKY,
      exclusive: EXCLUSIVE_LIGHT,
      onAir: ONAIR_LIGHT,
      rotation: { heavy: ROT_RED_L, medium: ROT_PINK_L, light: ROT_TEAL_L, singles: ROT_INDIGO_L },
      background: { body: "#fffbeb", surface: "#ffffff", popup: "#fef3c7", border: "#fde68a" },
    },
    dark: {
      primary: AMBER,
      neutral: NEUTRAL,
      success: EMERALD,
      warning: ORANGE,
      danger: RED,
      sidebar: AMBER,
      sidebarAdmin: EMERALD,
      formatVinyl: YELLOW,
      formatCd: SKY,
      exclusive: EXCLUSIVE_DARK,
      onAir: ONAIR_DARK,
      rotation: { heavy: ROT_RED_D, medium: ROT_PINK_D, light: ROT_TEAL_D, singles: ROT_INDIGO_D },
      background: DARK_BACKGROUND,
    },
  },
};
