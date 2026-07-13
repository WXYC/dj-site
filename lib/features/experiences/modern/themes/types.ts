import type { Rotation } from "@/lib/features/rotation/types";

/**
 * Modern theme identifiers.
 *
 * IMPORTANT: theme ids must match `^[a-z0-9]+$` (lowercase alphanumeric, no
 * dashes). The app-skin preference grammar (`modern-<themeId>-<mode>`) splits on
 * "-", so a dash inside a theme id would break parsing. See
 * `lib/features/experiences/preferences.ts`.
 */
export type ModernThemeId = string;

/** A full 50-900 tonal scale, as accepted by MUI Joy palettes. */
export interface PaletteScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

/** Per-mode color set for a single rotation bin chip/row. */
export interface RotationBinTokens {
  bg: string;
  bgHover: string;
  bgSelected: string;
  text: string;
  textSelected: string;
  border: string;
}

/** The WXYC "exclusive" brand accent (a single solid swatch, not a full scale). */
export interface ExclusiveTokens {
  solidBg: string;
  solidHoverBg: string;
  solidColor?: string;
}

/** The "on air" live indicator dot + its glow. */
export interface OnAirTokens {
  indicator: string;
  glow: string;
}

/**
 * Page + surface backgrounds and border for a scheme. Optional — omitting it
 * falls back to Joy's stock backgrounds. This is how a theme replaces the dated
 * near-black dark background with a softer surface.
 */
export interface BackgroundTokens {
  /** Page background (`background.body`). */
  body: string;
  /** Card/panel surface (`background.surface`). */
  surface: string;
  /** Elevated surfaces — menus, modals, raised rows (`background.popup`/`level1..3`). */
  popup: string;
  /** Divider / outlined border color. */
  border: string;
}

/**
 * One color scheme (light or dark) for a modern theme.
 *
 * Joy built-ins (primary/neutral/success/warning/danger) are optional — omitted
 * keys fall back to Joy's stock palette. Semantic slots are required so every
 * theme fully defines the WXYC color system.
 */
export interface ThemeSchemeInput {
  primary?: PaletteScale;
  neutral?: PaletteScale;
  success?: PaletteScale;
  warning?: PaletteScale;
  danger?: PaletteScale;

  /** Sidebar accent (decoupled from `primary`). */
  sidebar: PaletteScale;
  /** Sidebar accent while on an /admin route. */
  sidebarAdmin: PaletteScale;
  /** Dedicated hue for vinyl format badges. */
  formatVinyl: PaletteScale;
  /** Dedicated hue for CD format badges. */
  formatCd: PaletteScale;

  exclusive: ExclusiveTokens;
  onAir: OnAirTokens;
  rotation: Record<"heavy" | "medium" | "light" | "singles", RotationBinTokens>;
  /** Page/surface backgrounds; omit to keep Joy's stock backgrounds. */
  background?: BackgroundTokens;
}

/**
 * A complete modern theme. Adding a new theme = adding one file exporting one of
 * these and registering it in `themes/index.ts`.
 */
export interface ThemeDefinition {
  id: ModernThemeId;
  /** Human-readable name shown in the theme picker. */
  label: string;
  description?: string;
  /**
   * Optional explicit swatch previews (hex) for the picker. When omitted,
   * swatches are derived from the scheme palettes — see `getThemeSwatches`.
   */
  preview?: { light: string[]; dark: string[] };
  schemes: { light: ThemeSchemeInput; dark: ThemeSchemeInput };
}

/** Maps a `Rotation` bin id to the `rotation` token group key. */
export const ROTATION_BIN_KEY: Record<
  Rotation,
  keyof ThemeSchemeInput["rotation"]
> = {
  H: "heavy",
  M: "medium",
  L: "light",
  S: "singles",
};
