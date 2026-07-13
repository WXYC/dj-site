import { DEFAULT_MODERN_THEME_ID, getModernTheme } from "./themes";

/**
 * The default modern theme object. Retained as the historical entry point; the
 * modern experience can now render any registered theme (see `./themes`). Prefer
 * `getModernTheme(themeId)` when a specific theme is needed.
 */
export const modernTheme = getModernTheme(DEFAULT_MODERN_THEME_ID);

export default modernTheme;
