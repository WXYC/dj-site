import type {
  BackgroundTokens,
  ExclusiveTokens,
  OnAirTokens,
  PaletteScale,
  RotationBinTokens,
  ThemeDefinition,
} from "./types";

/**
 * All modern theme color definitions live in this one file. Adding a theme = add
 * a `ThemeDefinition` here and register it in `./registry.ts`. Infrastructure
 * (types, buildTheme, registry) stays separate; only the colors live here.
 *
 * The palettes deliberately use muted Material-design-style hues (not Tailwind's
 * brighter defaults), which read as more sophisticated for this UI.
 */

const rot = (
  bg: string, bgHover: string, bgSelected: string,
  text: string, textSelected: string, border: string
): RotationBinTokens => ({ bg, bgHover, bgSelected, text, textSelected, border });

// ===========================================================================
// WXYC Rose — the flagship. Rose primary, muted teal / stone / fuchsia accents.
// ===========================================================================
const ROSE: PaletteScale = { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337" };
const ROSE_DARK: PaletteScale = { 50: "#faeaef", 100: "#ecadc0", 200: "#e383a0", 300: "#d95a81", 400: "#d03161", 500: "#a6274e", 600: "#922244", 700: "#531427", 800: "#3e0f1d", 900: "#15050a" };
const TEAL: PaletteScale = { 50: "#e0f2f1", 100: "#b2dfdb", 200: "#80cbc4", 300: "#4db6ac", 400: "#26a69a", 500: "#009688", 600: "#00897b", 700: "#00796b", 800: "#00695c", 900: "#004d40" };
const TEAL_DARK: PaletteScale = { 50: "#e8f3f4", 100: "#b9dcdf", 200: "#74b9bf", 300: "#45a1a9", 400: "#178a94", 500: "#126e76", 600: "#106168", 700: "#0c454a", 800: "#07292c", 900: "#051c1e" };
const STONE: PaletteScale = { 50: "#fafaf9", 100: "#f5f5f4", 200: "#e7e5e4", 300: "#d6d3d1", 400: "#a8a29e", 500: "#78716c", 600: "#57534e", 700: "#44403c", 800: "#292524", 900: "#1c1917" };
const FUCHSIA: PaletteScale = { 50: "#fdf4ff", 100: "#fae8ff", 200: "#f5d0fe", 300: "#f0abfc", 400: "#e879f9", 500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f", 900: "#701a75" };
const INDIGO_DARK: PaletteScale = { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81" };

// Muted, sophisticated format hues that sit calmly next to rose.
const VINYL_GOLD: PaletteScale = { 50: "#faf6ea", 100: "#f2e7c9", 200: "#e6d09b", 300: "#d8b96e", 400: "#cba74c", 500: "#bf9436", 600: "#a17c2c", 700: "#7e6123", 800: "#5c471a", 900: "#3e3011" };
const CD_SLATE: PaletteScale = { 50: "#f2f5f8", 100: "#e0e8ef", 200: "#c3d2de", 300: "#9db6c9", 400: "#7699b0", 500: "#5b7a99", 600: "#4b6580", 700: "#3d5167", 800: "#2e3d4d", 900: "#202b36" };

const ROSE_EXCLUSIVE: ExclusiveTokens = { solidBg: "#7B2D8E", solidHoverBg: "#6a2479" };
const ROSE_ONAIR: OnAirTokens = { indicator: "#ef4444", glow: "rgba(239, 68, 68, 0.5)" };
// Dark surfaces: a warm rose-brown charcoal — hued toward terracotta (red > green
// > blue), not grape. Deep enough to read as solid dark without the purple haze.
const ROSE_DARK_BG: BackgroundTokens = { body: "#140f09", surface: "#241812", popup: "#2f2119", border: "#3d2c22" };

const ROSE_ROT_LIGHT = {
  heavy: rot("#fce4ec", "#f8bbd0", "#e53935", "#b71c1c", "#ffffff", "#ef9a9a"),
  medium: rot("#fff9c4", "#fff176", "#f9a825", "#f57f17", "#ffffff", "#fdd835"),
  light: rot("#e0f2f1", "#b2dfdb", "#00897b", "#004d40", "#ffffff", "#80cbc4"),
  singles: rot("#e8eaf6", "#c5cae9", "#5c6bc0", "#283593", "#ffffff", "#9fa8da"),
};
const ROSE_ROT_DARK = {
  heavy: rot("#4a1a1a", "#5c2020", "#e53935", "#ef9a9a", "#ffffff", "#7f3333"),
  medium: rot("#4a3a0a", "#5c4810", "#f9a825", "#fdd835", "#ffffff", "#7f6820"),
  light: rot("#1a3a36", "#204a44", "#00897b", "#80cbc4", "#ffffff", "#336a60"),
  singles: rot("#262a4a", "#30365c", "#5c6bc0", "#9fa8da", "#ffffff", "#4a5090"),
};

export const wxycRoseTheme: ThemeDefinition = {
  id: "default",
  label: "WXYC Rose",
  description: "The signature WXYC look — soft rose with muted teal and stone.",
  schemes: {
    light: {
      primary: ROSE,
      success: TEAL,
      warning: STONE,
      danger: FUCHSIA,
      sidebar: ROSE,
      sidebarAdmin: TEAL,
      formatVinyl: VINYL_GOLD,
      formatCd: CD_SLATE,
      exclusive: ROSE_EXCLUSIVE,
      onAir: ROSE_ONAIR,
      rotation: ROSE_ROT_LIGHT,
      background: { body: "#f4ece5", surface: "#fdf8f3", popup: "#efe4da", border: "#e4d5c8" },
    },
    dark: {
      primary: ROSE_DARK,
      success: TEAL_DARK,
      danger: INDIGO_DARK,
      sidebar: ROSE_DARK,
      sidebarAdmin: TEAL_DARK,
      formatVinyl: VINYL_GOLD,
      formatCd: CD_SLATE,
      exclusive: ROSE_EXCLUSIVE,
      onAir: ROSE_ONAIR,
      rotation: ROSE_ROT_DARK,
      background: ROSE_DARK_BG,
    },
  },
};

// ===========================================================================
// Solarized — the cool indigo/teal palette (formerly "Ocean"), renamed only.
// ===========================================================================
const INDIGO: PaletteScale = { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81" };
const OCEAN_TEAL: PaletteScale = { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a" };
const SLATE: PaletteScale = { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a" };
const CORAL: PaletteScale = { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337" };
const OCEAN_AMBER: PaletteScale = { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f" };
const CYAN: PaletteScale = { 50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9", 400: "#22d3ee", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 800: "#155e75", 900: "#164e63" };

const OCEAN_EXCLUSIVE: ExclusiveTokens = { solidBg: "#8b5cf6", solidHoverBg: "#7c3aed" };
const OCEAN_ONAIR: OnAirTokens = { indicator: "#f43f5e", glow: "rgba(244, 63, 94, 0.5)" };
const OCEAN_DARK_BG: BackgroundTokens = { body: "#111821", surface: "#1a2430", popup: "#24303d", border: "#313f4d" };

const OCEAN_ROT_LIGHT = {
  heavy: rot("#e0e7ff", "#c7d2fe", "#4f46e5", "#312e81", "#ffffff", "#a5b4fc"),
  medium: rot("#ccfbf1", "#99f6e4", "#0d9488", "#134e4a", "#ffffff", "#5eead4"),
  light: rot("#cffafe", "#a5f3fc", "#0891b2", "#164e63", "#ffffff", "#67e8f9"),
  singles: rot("#f1f5f9", "#e2e8f0", "#475569", "#0f172a", "#ffffff", "#cbd5e1"),
};
const OCEAN_ROT_DARK = {
  heavy: rot("#1e1b4b", "#312e81", "#6366f1", "#c7d2fe", "#ffffff", "#4338ca"),
  medium: rot("#0f2e2b", "#115e59", "#14b8a6", "#99f6e4", "#ffffff", "#0f766e"),
  light: rot("#0a2e38", "#155e75", "#06b6d4", "#a5f3fc", "#ffffff", "#0e7490"),
  singles: rot("#1e293b", "#334155", "#64748b", "#cbd5e1", "#ffffff", "#475569"),
};

export const solarizedTheme: ThemeDefinition = {
  id: "solarized",
  label: "Solarized",
  description: "Cool indigo and teal, like the coast at night.",
  schemes: {
    light: {
      primary: INDIGO,
      neutral: SLATE,
      success: OCEAN_TEAL,
      warning: OCEAN_AMBER,
      danger: CORAL,
      sidebar: INDIGO,
      sidebarAdmin: OCEAN_TEAL,
      formatVinyl: OCEAN_AMBER,
      formatCd: CYAN,
      exclusive: OCEAN_EXCLUSIVE,
      onAir: OCEAN_ONAIR,
      rotation: OCEAN_ROT_LIGHT,
      background: { body: "#eef2f7", surface: "#ffffff", popup: "#e6ecf3", border: "#dae2ec" },
    },
    dark: {
      primary: INDIGO,
      neutral: SLATE,
      success: OCEAN_TEAL,
      warning: OCEAN_AMBER,
      danger: CORAL,
      sidebar: INDIGO,
      sidebarAdmin: OCEAN_TEAL,
      formatVinyl: OCEAN_AMBER,
      formatCd: CYAN,
      exclusive: OCEAN_EXCLUSIVE,
      onAir: OCEAN_ONAIR,
      rotation: OCEAN_ROT_DARK,
      background: OCEAN_DARK_BG,
    },
  },
};

// ===========================================================================
// Paper Retro — an old-fashioned switchboard: warm cream paper, rustic brown
// scaffolding, and the striking bakelite reds/greens of patch cables. Muted and
// a touch "plasticky" (warm, slightly hazy surfaces) rather than bright.
// ===========================================================================
// Warm coffee brown — the rustic base (sidebar / primary).
const BROWN: PaletteScale = { 50: "#f5ede4", 100: "#e8d8c3", 200: "#d8bd9c", 300: "#c5a074", 400: "#b3854f", 500: "#9c6d3a", 600: "#855b30", 700: "#6b4826", 800: "#4f351c", 900: "#382512" };
const BROWN_DARK: PaletteScale = { 50: "#f2e7d6", 100: "#e6d0b0", 200: "#d4b487", 300: "#c2985e", 400: "#b07f3c", 500: "#96682f", 600: "#7e5628", 700: "#4e3619", 800: "#37260f", 900: "#160e05" };
// Striking-but-muted switchboard green (success / admin sidebar).
const RETRO_GREEN: PaletteScale = { 50: "#eaf1e6", 100: "#cddcc3", 200: "#a9c199", 300: "#83a56d", 400: "#648a4b", 500: "#4a7233", 600: "#3d5f2a", 700: "#2f4a20", 800: "#223616", 900: "#16240d" };
const RETRO_GREEN_DARK: PaletteScale = { 50: "#e9f0e2", 100: "#c4d6b4", 200: "#a0bd8b", 300: "#7ca362", 400: "#5d8944", 500: "#476b32", 600: "#3a5729", 700: "#26391b", 800: "#17240f", 900: "#0b1307" };
// Warm ochre/mustard (warning) and striking brick red (danger + on-air).
const MUSTARD: PaletteScale = { 50: "#faf3e0", 100: "#f0e0b0", 200: "#e4c87d", 300: "#d6ad4c", 400: "#c99a2e", 500: "#b5851f", 600: "#976d19", 700: "#755311", 800: "#523a0b", 900: "#322406" };
const BRICK: PaletteScale = { 50: "#fbeae5", 100: "#f3c6ba", 200: "#e79c88", 300: "#d9715a", 400: "#cc4f34", 500: "#b23a20", 600: "#96301a", 700: "#742514", 800: "#52190d", 900: "#331008" };
// Warm taupe scaffolding neutral.
const TAUPE: PaletteScale = { 50: "#f4f1ec", 100: "#e6e0d6", 200: "#d2c8b9", 300: "#b9ab97", 400: "#9c8b73", 500: "#7d6e58", 600: "#665a48", 700: "#4e4537", 800: "#372f25", 900: "#221d16" };
// Formats: warm tube-amber vinyl vs. a cool dusty petrol-blue CD (cool contrast
// keeps it from clashing with all the warm browns/greens).
const VINYL_AMBER: PaletteScale = { 50: "#fbefd9", 100: "#f4d9a6", 200: "#e9bd6c", 300: "#dba23c", 400: "#c98a24", 500: "#ac7317", 600: "#8c5d12", 700: "#6a460d", 800: "#493008", 900: "#2c1d04" };
const CD_DENIM: PaletteScale = { 50: "#e8eef2", 100: "#c8d7e0", 200: "#9fb8c8", 300: "#7597af", 400: "#567d98", 500: "#3f6580", 600: "#345268", 700: "#283f50", 800: "#1c2c38", 900: "#121c24" };

const PAPER_EXCLUSIVE: ExclusiveTokens = { solidBg: "#7a3b57", solidHoverBg: "#68304a" };
const PAPER_ONAIR: OnAirTokens = { indicator: "#cc4f34", glow: "rgba(204, 79, 52, 0.5)" };
// Dark surfaces: warm bakelite brown-black — deep but never neutral-black, with a
// faintly "plasticky" warmth.
const PAPER_DARK_BG: BackgroundTokens = { body: "#211a12", surface: "#2c2318", popup: "#372c1e", border: "#443627" };

const PAPER_ROT_LIGHT = {
  heavy: rot("#f5ddd5", "#ecc3b5", "#b23a20", "#5e1c10", "#ffffff", "#dfa898"),
  medium: rot("#f7eccf", "#efdca6", "#b5851f", "#5e4410", "#ffffff", "#e0c98a"),
  light: rot("#e2ecd8", "#cbddba", "#4a7233", "#243818", "#ffffff", "#b3c99f"),
  singles: rot("#e4ddce", "#d3c8b2", "#7d6e58", "#3a3226", "#ffffff", "#c2b49a"),
};
const PAPER_ROT_DARK = {
  heavy: rot("#3f1a10", "#521f12", "#cc4f34", "#e79c88", "#ffffff", "#6e2c1a"),
  medium: rot("#3d300f", "#4e3e12", "#c99a2e", "#e4c87d", "#ffffff", "#6b551a"),
  light: rot("#1f2e14", "#2b3d1a", "#648a4b", "#a9c199", "#ffffff", "#3d5228"),
  singles: rot("#332c1e", "#443a28", "#9c8b73", "#d2c8b9", "#ffffff", "#5a4e3a"),
};

export const paperRetroTheme: ThemeDefinition = {
  id: "paper",
  label: "Paper Retro",
  description: "A vintage switchboard — cream paper, rustic browns, bakelite red and green.",
  schemes: {
    light: {
      primary: BROWN,
      neutral: TAUPE,
      success: RETRO_GREEN,
      warning: MUSTARD,
      danger: BRICK,
      sidebar: BROWN,
      sidebarAdmin: RETRO_GREEN,
      formatVinyl: VINYL_AMBER,
      formatCd: CD_DENIM,
      exclusive: PAPER_EXCLUSIVE,
      onAir: PAPER_ONAIR,
      rotation: PAPER_ROT_LIGHT,
      background: { body: "#e9ddc8", surface: "#f7efe0", popup: "#efe4d0", border: "#d8c6a8" },
    },
    dark: {
      primary: BROWN_DARK,
      neutral: TAUPE,
      success: RETRO_GREEN_DARK,
      warning: MUSTARD,
      danger: BRICK,
      sidebar: BROWN_DARK,
      sidebarAdmin: RETRO_GREEN_DARK,
      formatVinyl: VINYL_AMBER,
      formatCd: CD_DENIM,
      exclusive: PAPER_EXCLUSIVE,
      onAir: PAPER_ONAIR,
      rotation: PAPER_ROT_DARK,
      background: PAPER_DARK_BG,
    },
  },
};
