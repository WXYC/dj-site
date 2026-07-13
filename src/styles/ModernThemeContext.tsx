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
  /** Switch the active modern theme. Instant (client-side theme swap). */
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
