import { extendTheme, type Theme } from "@mui/joy/styles";
import { Kanit } from "next/font/google";
import localFont from "next/font/local";
import { createVariantPalette } from "./tokens";
import type { ThemeDefinition, ThemeSchemeInput } from "./types";

const bodyFont = Kanit({
  weight: ["400", "500"],
  style: "normal",
  subsets: ["latin"],
});

// Kanit has no CJK glyphs, so every Han/kana/Hangul character falls back. Left
// to the OS's own fallback search, Chrome can settle on a locally installed CJK
// face with a broken cmap, which draws wrong-but-plausible characters (猜拳
// shows as 耽泮), and only at the weight it happens to win (500, the song
// column). Naming known-good system faces first takes that search out of play.
// PingFang SC leads because the station machines are Macs; Hiragino covers
// Japanese, Apple SD Gothic Neo / Malgun Gothic cover Hangul, and the
// Windows/Linux faces cover non-Mac browsers.
//
// Appended here rather than passed as Kanit's `fallback` option: under
// Turbopack that option replaces the metric-matched 'Kanit Fallback' face, and
// losing it reintroduces layout shift while Kanit loads. 'Kanit Fallback' is
// Arial underneath, which has no CJK glyphs, so CJK still reaches this list.
const bodyFontFamily = [
  bodyFont.style.fontFamily,
  "PingFang SC",
  "PingFang TC",
  "Hiragino Sans",
  "Hiragino Kaku Gothic ProN",
  "Apple SD Gothic Neo",
  "Microsoft YaHei",
  "Microsoft JhengHei",
  "Yu Gothic",
  "Malgun Gothic",
  "Noto Sans CJK SC",
  "sans-serif",
].join(", ");

// Subset to Basic Latin + Latin-1 Supplement + Latin Extended-A (a superset of
// the source face's own coverage, which tops out at U+0178): h1-h4 render
// arbitrary page titles via PageHeader, not a fixed wordmark, so codepoints for
// catalog-driven diacritics (e.g. Nilüfer Yanya) must stay in the face. Minbus
// is a base-Latin display face with no accent glyphs, so those codepoints map
// to their base letters (ü -> u); keeping them in the cmap renders the base
// letter in-face rather than swapping mid-word to a fallback font for the
// accented character.
const titleFont = localFont({
  src: [
    {
      path: "../../../../../public/fonts/Minbus.woff2",
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
    display: bodyFontFamily,
    body: bodyFontFamily,
  },
  // Kanit loads 400 and 500 only; Joy's stock lg (600) and xl (700) would be synthesized bolds.
  fontWeight: { md: 500, lg: 500, xl: 500 },
  typography: {
    "title-lg": { fontWeight: 500 },
    "title-md": { fontWeight: 500 },
    "title-sm": { fontWeight: 500 },
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
      fontFamily: bodyFontFamily,
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
