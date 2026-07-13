"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  DEFAULT_MODERN_THEME_ID,
  resolveModernThemeId,
} from "@/lib/features/experiences/modern/themes/registry";

interface ModernThemeContextValue {
  /** The active modern theme id (always a resolved, known id). */
  themeId: string;
  /**
   * Update the context's theme id (keeps consumers like the preference-sync
   * hook consistent). NOTE: this does NOT repaint the page — Joy's
   * CssVarsProvider doesn't regenerate its injected :root vars when the theme
   * object changes at runtime, so an actual theme change persists the
   * preference and reloads (see ThemePicker). A true no-reload swap is a
   * known follow-up.
   */
  setThemeId: (id: string) => void;
}

const ModernThemeContext = createContext<ModernThemeContextValue>({
  themeId: DEFAULT_MODERN_THEME_ID,
  setThemeId: () => {},
});

/**
 * Holds the active modern theme id, seeded from the server-resolved preference so
 * SSR output matches the first client render (no flash of the default theme).
 * The theme picker and the preference-sync hook read/write through this.
 */
export function ModernThemeProvider({
  initialThemeId,
  children,
}: PropsWithChildren<{ initialThemeId: string }>) {
  const [themeId, setThemeIdState] = useState(() =>
    resolveModernThemeId(initialThemeId)
  );

  const value = useMemo<ModernThemeContextValue>(
    () => ({
      themeId,
      setThemeId: (id: string) => setThemeIdState(resolveModernThemeId(id)),
    }),
    [themeId]
  );

  return (
    <ModernThemeContext.Provider value={value}>
      {children}
    </ModernThemeContext.Provider>
  );
}

export function useModernTheme(): ModernThemeContextValue {
  return useContext(ModernThemeContext);
}
