import { extendTheme, type Theme } from "@mui/joy/styles";
import { Kanit } from "next/font/google";
import localFont from "next/font/local";
import { createVariantPalette } from "./tokens";
import type { ThemeDefinition, ThemeSchemeInput } from "./types";

const bodyFont = Kanit({
  weight: "400",
  style: "normal",
  subsets: ["latin"],
});

const titleFont = localFont({
  src: [
    {
      path: "../../../../../public/fonts/Minbus.otf",
      weight: "100",
    },
  ],
});

declare module "@mui/joy/styles" {
  interface TypographySystemOverrides {
    "body-xxs": true;
  }
}

/**
 * Shared, theme-independent modern configuration: WXYC css-var prefix, fonts,
 * typography scale, and component overrides. Every modern theme is built on top
 * of this; only the palettes differ between themes.
 */
const modernBase = {
  cssVarPrefix: "wxyc",
  components: {
    JoyTooltip: {
      styleOverrides: {
        root: {
          zIndex: 10000,
        },
      },
    },
  },
  fontFamily: {
    display: bodyFont.style.fontFamily,
    body: bodyFont.style.fontFamily,
  },
  typography: {
    h1: {
      fontFamily: titleFont.style.fontFamily,
      fontWeight: "100",
      fontSize: "4.5rem",
    },
    h2: {
      fontFamily: titleFont.style.fontFamily,
      fontWeight: "100",
      fontSize: "3.75rem",
    },
    h3: {
      fontFamily: titleFont.style.fontFamily,
      fontWeight: "100",
      fontSize: "3rem",
    },
    h4: {
      fontFamily: titleFont.style.fontFamily,
      fontWeight: "100",
      fontSize: "2.125rem",
    },
    "body-xxs": {
      fontFamily: bodyFont.style.fontFamily,
      fontSize: "0.6rem",
    },
  },
};

/**
 * Translate one theme scheme into a Joy palette. Built-in palettes are passed
 * through (Joy generates their variant tokens); the full-scale semantic slots are
 * expanded with `createVariantPalette` so they behave like first-class colors.
 */
function toJoyPalette(scheme: ThemeSchemeInput, mode: "light" | "dark") {
  const palette: Record<string, unknown> = {
    sidebar: createVariantPalette(scheme.sidebar, mode),
    sidebarAdmin: createVariantPalette(scheme.sidebarAdmin, mode),
    formatVinyl: createVariantPalette(scheme.formatVinyl, mode),
    formatCd: createVariantPalette(scheme.formatCd, mode),
    exclusive: {
      solidColor: "#fff",
      ...scheme.exclusive,
    },
    onAir: scheme.onAir,
    rotation: scheme.rotation,
  };

  // Built-in palettes: only include the ones this scheme overrides so the rest
  // fall through to Joy's stock values.
  for (const key of ["primary", "neutral", "success", "warning", "danger"] as const) {
    if (scheme[key]) palette[key] = scheme[key];
  }

  // Page/surface backgrounds + divider (the dark-background fix).
  if (scheme.background) {
    const { body, surface, popup, border } = scheme.background;
    palette.background = {
      body,
      surface,
      popup,
      level1: popup,
      level2: popup,
      level3: popup,
      tooltip: popup,
    };
    palette.divider = border;
  }

  return palette;
}

/**
 * Build a Joy `Theme` from a `ThemeDefinition`. Pure/deterministic; callers
 * memoize via `getModernTheme`.
 */
export function buildModernTheme(def: ThemeDefinition): Theme {
  return extendTheme({
    ...modernBase,
    colorSchemes: {
      light: { palette: toJoyPalette(def.schemes.light, "light") },
      dark: { palette: toJoyPalette(def.schemes.dark, "dark") },
    },
  });
}
