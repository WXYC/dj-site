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

// Theme labels are music/radio references; the `id`s below stay fixed for
// preference back-compat (they're persisted in cookies/accounts).

// ===========================================================================
// The Stacks (id "default") — the flagship. Warm record-library rose: rose
// primary, muted teal / stone / fuchsia accents, warm greige neutral.
// ===========================================================================
const ROSE: PaletteScale = { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337" };
const ROSE_DARK: PaletteScale = { 50: "#faeaef", 100: "#ecadc0", 200: "#e383a0", 300: "#d95a81", 400: "#d03161", 500: "#a6274e", 600: "#922244", 700: "#531427", 800: "#3e0f1d", 900: "#15050a" };
const TEAL: PaletteScale = { 50: "#e0f2f1", 100: "#b2dfdb", 200: "#80cbc4", 300: "#4db6ac", 400: "#26a69a", 500: "#009688", 600: "#00897b", 700: "#00796b", 800: "#00695c", 900: "#004d40" };
const TEAL_DARK: PaletteScale = { 50: "#e8f3f4", 100: "#b9dcdf", 200: "#74b9bf", 300: "#45a1a9", 400: "#178a94", 500: "#126e76", 600: "#106168", 700: "#0c454a", 800: "#07292c", 900: "#051c1e" };
const STONE: PaletteScale = { 50: "#fafaf9", 100: "#f5f5f4", 200: "#e7e5e4", 300: "#d6d3d1", 400: "#a8a29e", 500: "#78716c", 600: "#57534e", 700: "#44403c", 800: "#292524", 900: "#1c1917" };
// Warm greige neutral so incidental greys (outlined borders, muted text, neutral
// chips) harmonize with the chocolate surfaces instead of reading as cool grey.
const ROSE_NEUTRAL: PaletteScale = { 50: "#f6f3f1", 100: "#ebe5e1", 200: "#ddd4ce", 300: "#c9bcb3", 400: "#ab9c92", 500: "#8a7b71", 600: "#6e615a", 700: "#554a45", 800: "#3a322e", 900: "#241f1c" };
const FUCHSIA: PaletteScale = { 50: "#fdf4ff", 100: "#fae8ff", 200: "#f5d0fe", 300: "#f0abfc", 400: "#e879f9", 500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f", 900: "#701a75" };
const INDIGO_DARK: PaletteScale = { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81" };

// Muted, sophisticated format hues that sit calmly next to rose.
const VINYL_GOLD: PaletteScale = { 50: "#faf6ea", 100: "#f2e7c9", 200: "#e6d09b", 300: "#d8b96e", 400: "#cba74c", 500: "#bf9436", 600: "#a17c2c", 700: "#7e6123", 800: "#5c471a", 900: "#3e3011" };
const CD_SLATE: PaletteScale = { 50: "#f2f5f8", 100: "#e0e8ef", 200: "#c3d2de", 300: "#9db6c9", 400: "#7699b0", 500: "#5b7a99", 600: "#4b6580", 700: "#3d5167", 800: "#2e3d4d", 900: "#202b36" };

const ROSE_EXCLUSIVE: ExclusiveTokens = { solidBg: "#7B2D8E", solidHoverBg: "#6a2479" };
const ROSE_ONAIR: OnAirTokens = { indicator: "#ef4444", glow: "rgba(239, 68, 68, 0.5)" };
// Dark surfaces: a muted warm charcoal — still red > green > blue (no grape), but
// desaturated toward a gritty greige and kept deep, not glowing terracotta.
const ROSE_DARK_BG: BackgroundTokens = { body: "#120f0b", surface: "#201914", popup: "#2b221c", border: "#392d26" };

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

export const theStacksTheme: ThemeDefinition = {
  id: "default",
  label: "The Stacks",
  description: "The signature WXYC look — warm library rose with muted teal and stone.",
  schemes: {
    light: {
      primary: ROSE,
      neutral: ROSE_NEUTRAL,
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
      background: { body: "#f5f3f1", surface: "#ffffff", popup: "#ece8e5", border: "#ddd6d1" },
    },
    dark: {
      primary: ROSE_DARK,
      neutral: ROSE_NEUTRAL,
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
// Blue Note (id "solarized") — the cool indigo/teal palette, like the late shift.
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

export const blueNoteTheme: ThemeDefinition = {
  id: "solarized",
  label: "Blue Note",
  description: "Cool indigo and teal, like the late shift after midnight.",
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
// Shellac (id "paper") — old shellac 78s and an antique switchboard: warm cream
// paper, rustic brown scaffolding, and the striking bakelite reds/greens of patch
// cables. Muted and a touch "plasticky" (warm, slightly hazy) rather than bright.
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

export const shellacTheme: ThemeDefinition = {
  id: "paper",
  label: "Shellac",
  description: "Old shellac 78s — cream paper, rustic browns, bakelite red and green.",
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

// ===========================================================================
// Deadstock (id "deadstock") — a punk/vampire blackout: stark black and white
// with blood red as the centerpiece. Bright crimson sidebar, near-black surfaces
// with a faint blood undertone, records in oxblood vs. silver.
// ===========================================================================
const CRIMSON: PaletteScale = { 50: "#fdeaea", 100: "#f9c6c6", 200: "#ef9a9a", 300: "#e56b6b", 400: "#d84343", 500: "#c1121f", 600: "#a50f1a", 700: "#870c15", 800: "#5f0a10", 900: "#3a060a" };
// Brighter blood red so the sidebar/primary pops against near-black in dark mode.
const CRIMSON_DARK: PaletteScale = { 50: "#fdeaea", 100: "#f4b4b4", 200: "#ea8585", 300: "#e05a5a", 400: "#d63a3a", 500: "#e02424", 600: "#c11a1a", 700: "#7a1010", 800: "#500a0a", 900: "#240404" };
const ZINC: PaletteScale = { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b" };
const STEEL: PaletteScale = { 50: "#eef2f4", 100: "#d5dfe4", 200: "#b3c5cd", 300: "#8ba7b3", 400: "#6a8b99", 500: "#4f7180", 600: "#415d6a", 700: "#334954", 800: "#25343c", 900: "#182329" };
const BONE: PaletteScale = { 50: "#faf7f0", 100: "#f0e8d5", 200: "#e2d3b0", 300: "#d0b981", 400: "#bda158", 500: "#a9822b", 600: "#8c6b23", 700: "#6b521b", 800: "#4c3a13", 900: "#30250c" };
// Records: deep oxblood vinyl vs. silver CD.
const OXBLOOD: PaletteScale = { 50: "#f6eaea", 100: "#e7c2c2", 200: "#d29494", 300: "#bd6666", 400: "#a94141", 500: "#7f1d1d", 600: "#6b1717", 700: "#531111", 800: "#3a0c0c", 900: "#240606" };
const SILVER: PaletteScale = { 50: "#f4f5f6", 100: "#e5e7ea", 200: "#cdd1d6", 300: "#aab1b9", 400: "#828b95", 500: "#646d77", 600: "#525a63", 700: "#41474e", 800: "#2e3339", 900: "#1e2226" };

const DEAD_EXCLUSIVE: ExclusiveTokens = { solidBg: "#a50f1a", solidHoverBg: "#870c15" };
const DEAD_ONAIR: OnAirTokens = { indicator: "#e02424", glow: "rgba(224, 36, 36, 0.55)" };
// Near-black with a faint blood undertone (red > green >= blue), vampiric.
const DEAD_DARK_BG: BackgroundTokens = { body: "#0c0a0b", surface: "#171314", popup: "#201a1b", border: "#2e2626" };

const DEAD_ROT_LIGHT = {
  heavy: rot("#fde8e8", "#f8c9c9", "#c1121f", "#7a0c14", "#ffffff", "#eaa5a5"),
  medium: rot("#f6efe0", "#ecdcbb", "#a9822b", "#5e4715", "#ffffff", "#dcc79a"),
  light: rot("#e7ecef", "#cdd8de", "#4f7180", "#2f4350", "#ffffff", "#a9bcc6"),
  singles: rot("#ececed", "#dcdcde", "#6b6b72", "#33333a", "#ffffff", "#c3c3c8"),
};
const DEAD_ROT_DARK = {
  heavy: rot("#3a0d0d", "#4d1212", "#e02424", "#f0a5a5", "#ffffff", "#661717"),
  medium: rot("#332a12", "#463916", "#c99a2e", "#e4c87d", "#ffffff", "#6b551a"),
  light: rot("#182228", "#213038", "#5a90a8", "#a9ccdb", "#ffffff", "#31485a"),
  singles: rot("#26262a", "#34343a", "#8a8a92", "#d2d2d8", "#ffffff", "#4a4a52"),
};

export const deadstockTheme: ThemeDefinition = {
  id: "deadstock",
  label: "Deadstock",
  description: "A punk blackout — stark black and white with blood-red at the center.",
  schemes: {
    light: {
      primary: CRIMSON,
      neutral: ZINC,
      success: STEEL,
      warning: BONE,
      danger: CRIMSON,
      sidebar: CRIMSON,
      sidebarAdmin: ZINC,
      formatVinyl: OXBLOOD,
      formatCd: SILVER,
      exclusive: DEAD_EXCLUSIVE,
      onAir: DEAD_ONAIR,
      rotation: DEAD_ROT_LIGHT,
      background: { body: "#f5f3f3", surface: "#ffffff", popup: "#ece8e8", border: "#dcd4d4" },
    },
    dark: {
      primary: CRIMSON_DARK,
      neutral: ZINC,
      success: STEEL,
      warning: BONE,
      danger: CRIMSON_DARK,
      sidebar: CRIMSON_DARK,
      sidebarAdmin: ZINC,
      formatVinyl: OXBLOOD,
      formatCd: SILVER,
      exclusive: DEAD_EXCLUSIVE,
      onAir: DEAD_ONAIR,
      rotation: DEAD_ROT_DARK,
      background: DEAD_DARK_BG,
    },
  },
};
