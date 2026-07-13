import type { PaletteScale, ThemeDefinition } from "../types";

/**
 * A cool "Ocean" theme — indigo primary, teal success, slate neutrals. Serves as
 * the reference example that adding a theme is a single self-contained file:
 * define scales + semantic slots, then register it in `themes/index.ts`.
 */
const INDIGO: PaletteScale = {
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
const TEAL: PaletteScale = {
  50: "#f0fdfa",
  100: "#ccfbf1",
  200: "#99f6e4",
  300: "#5eead4",
  400: "#2dd4bf",
  500: "#14b8a6",
  600: "#0d9488",
  700: "#0f766e",
  800: "#115e59",
  900: "#134e4a",
};
const SLATE: PaletteScale = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
};
const CORAL: PaletteScale = {
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
const CYAN: PaletteScale = {
  50: "#ecfeff",
  100: "#cffafe",
  200: "#a5f3fc",
  300: "#67e8f9",
  400: "#22d3ee",
  500: "#06b6d4",
  600: "#0891b2",
  700: "#0e7490",
  800: "#155e75",
  900: "#164e63",
};

const EXCLUSIVE = { solidBg: "#8b5cf6", solidHoverBg: "#7c3aed", solidColor: "#fff" };
const ON_AIR = { indicator: "#f43f5e", glow: "rgba(244, 63, 94, 0.5)" };

const ROTATION_LIGHT = {
  heavy: { bg: "#e0e7ff", bgHover: "#c7d2fe", bgSelected: "#4f46e5", text: "#312e81", textSelected: "#fff", border: "#a5b4fc" },
  medium: { bg: "#ccfbf1", bgHover: "#99f6e4", bgSelected: "#0d9488", text: "#134e4a", textSelected: "#fff", border: "#5eead4" },
  light: { bg: "#cffafe", bgHover: "#a5f3fc", bgSelected: "#0891b2", text: "#164e63", textSelected: "#fff", border: "#67e8f9" },
  singles: { bg: "#f1f5f9", bgHover: "#e2e8f0", bgSelected: "#475569", text: "#0f172a", textSelected: "#fff", border: "#cbd5e1" },
};
const ROTATION_DARK = {
  heavy: { bg: "#1e1b4b", bgHover: "#312e81", bgSelected: "#6366f1", text: "#c7d2fe", textSelected: "#fff", border: "#4338ca" },
  medium: { bg: "#0f2e2b", bgHover: "#115e59", bgSelected: "#14b8a6", text: "#99f6e4", textSelected: "#fff", border: "#0f766e" },
  light: { bg: "#0a2e38", bgHover: "#155e75", bgSelected: "#06b6d4", text: "#a5f3fc", textSelected: "#fff", border: "#0e7490" },
  singles: { bg: "#1e293b", bgHover: "#334155", bgSelected: "#64748b", text: "#cbd5e1", textSelected: "#fff", border: "#475569" },
};

export const oceanTheme: ThemeDefinition = {
  id: "ocean",
  label: "Ocean",
  description: "Cool indigo and teal, like the coast at night.",
  schemes: {
    light: {
      primary: INDIGO,
      neutral: SLATE,
      success: TEAL,
      warning: AMBER,
      danger: CORAL,
      sidebar: INDIGO,
      sidebarAdmin: TEAL,
      formatVinyl: AMBER,
      formatCd: CYAN,
      exclusive: EXCLUSIVE,
      onAir: ON_AIR,
      rotation: ROTATION_LIGHT,
    },
    dark: {
      primary: INDIGO,
      neutral: SLATE,
      success: TEAL,
      warning: AMBER,
      danger: CORAL,
      sidebar: INDIGO,
      sidebarAdmin: TEAL,
      formatVinyl: AMBER,
      formatCd: CYAN,
      exclusive: EXCLUSIVE,
      onAir: ON_AIR,
      rotation: ROTATION_DARK,
    },
  },
};

export default oceanTheme;
