import { solarizedTheme, wxycRoseTheme } from "./definitions";
import type { ModernThemeId, ThemeDefinition } from "./types";

/**
 * Pure theme registry data + validation. Deliberately free of `buildTheme`
 * (which imports `next/font`), so server code and the string-only preference
 * parser can validate theme ids cheaply. `getModernTheme` lives in `./index`.
 */

export const DEFAULT_MODERN_THEME_ID = "default";

/**
 * All registered modern themes. Adding a theme = import its definition and add it
 * here (its `id` must be unique and match `^[a-z0-9]+$`).
 */
export const MODERN_THEMES: Record<ModernThemeId, ThemeDefinition> = {
  [wxycRoseTheme.id]: wxycRoseTheme,
  [solarizedTheme.id]: solarizedTheme,
};

/** Ordered list for the picker (default first). */
export const MODERN_THEME_LIST: ThemeDefinition[] = [wxycRoseTheme, solarizedTheme];

export const THEME_ID_PATTERN = /^[a-z0-9]+$/;

export function isModernThemeId(value: unknown): value is ModernThemeId {
  return (
    typeof value === "string" &&
    THEME_ID_PATTERN.test(value) &&
    value in MODERN_THEMES
  );
}

/**
 * Coerce an arbitrary value to a known theme id, falling back to the default.
 * Unknown ids degrade rather than throw so older/newer clients interoperate.
 */
export function resolveModernThemeId(value: unknown): ModernThemeId {
  return isModernThemeId(value) ? value : DEFAULT_MODERN_THEME_ID;
}

/**
 * Swatches for the picker preview: primary, sidebar, success/admin, and a format
 * accent, taken from the requested mode's scales. A definition may override via
 * its `preview` field.
 */
export function getThemeSwatches(
  def: ThemeDefinition,
  mode: "light" | "dark"
): string[] {
  if (def.preview) return def.preview[mode];
  const scheme = def.schemes[mode];
  return [
    scheme.primary?.[500] ?? scheme.sidebar[500],
    scheme.success?.[500] ?? scheme.sidebarAdmin[500],
    scheme.formatVinyl[500],
    scheme.formatCd[500],
  ];
}
