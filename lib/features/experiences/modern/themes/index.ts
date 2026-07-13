import type { Theme } from "@mui/joy/styles";
import { buildModernTheme } from "./buildTheme";
import { defaultTheme } from "./definitions/default";
import { oceanTheme } from "./definitions/ocean";
import type { ModernThemeId, ThemeDefinition } from "./types";

export const DEFAULT_MODERN_THEME_ID = "default";

/**
 * All registered modern themes. Adding a theme = import its definition and add it
 * here (its `id` must be unique and match `^[a-z0-9]+$`).
 */
export const MODERN_THEMES: Record<ModernThemeId, ThemeDefinition> = {
  [defaultTheme.id]: defaultTheme,
  [oceanTheme.id]: oceanTheme,
};

/** Ordered list for the picker (default first). */
export const MODERN_THEME_LIST: ThemeDefinition[] = [
  defaultTheme,
  oceanTheme,
];

const THEME_ID_PATTERN = /^[a-z0-9]+$/;

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

const themeCache = new Map<ModernThemeId, Theme>();

/** Build (and memoize) the Joy theme for a given id, falling back to default. */
export function getModernTheme(id: ModernThemeId): Theme {
  const resolvedId = resolveModernThemeId(id);
  const cached = themeCache.get(resolvedId);
  if (cached) return cached;
  const theme = buildModernTheme(MODERN_THEMES[resolvedId]);
  themeCache.set(resolvedId, theme);
  return theme;
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
    scheme.sidebar[500],
    scheme.success?.[500] ?? scheme.sidebarAdmin[500],
    scheme.formatVinyl[500],
  ];
}

export type { ModernThemeId, ThemeDefinition } from "./types";
