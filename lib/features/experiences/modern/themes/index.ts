import type { Theme } from "@mui/joy/styles";
import { buildModernTheme } from "./buildTheme";
import {
  MODERN_THEMES,
  resolveModernThemeId,
} from "./registry";
import type { ModernThemeId } from "./types";

export {
  DEFAULT_MODERN_THEME_ID,
  MODERN_THEMES,
  MODERN_THEME_LIST,
  THEME_ID_PATTERN,
  isModernThemeId,
  resolveModernThemeId,
  getThemeSwatches,
} from "./registry";
export type { ModernThemeId, ThemeDefinition } from "./types";

const themeCache = new Map<ModernThemeId, Theme>();

/**
 * Build (and memoize) the Joy theme for a given id, falling back to default.
 * NOTE: importing this module pulls in `next/font` via `buildTheme`; server code
 * that only needs id validation should import from `./registry` instead.
 */
export function getModernTheme(id: ModernThemeId): Theme {
  const resolvedId = resolveModernThemeId(id);
  const cached = themeCache.get(resolvedId);
  if (cached) return cached;
  const theme = buildModernTheme(MODERN_THEMES[resolvedId]);
  themeCache.set(resolvedId, theme);
  return theme;
}
