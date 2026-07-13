"use client";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { GlobalStyles } from "@mui/joy";
import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import { useServerInsertedHTML } from "next/navigation";
import { useState, type PropsWithChildren } from "react";
import type { ExperienceId } from "@/lib/features/experiences/types";
import { getModernTheme } from "@/lib/features/experiences/modern/themes";
import {
  ModernThemeProvider,
  useModernTheme,
} from "@/src/styles/ModernThemeContext";
import { useThemePreferenceSync } from "@/src/hooks/themePreferenceHooks";
import classicTheme from "@/lib/features/experiences/classic/theme";

// This implementation is from emotion-js
// https://github.com/emotion-js/emotion/issues/2928#issuecomment-1319747902
export default function ThemeRegistry(
  props: PropsWithChildren<{
    options?: any;
    experience: ExperienceId;
    themeId: string;
  }>
) {
  const { options, experience, themeId, children } = props;

  const [{ cache, flush }] = useState(() => {
    const cache = createCache(options);
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) {
      return null;
    }
    let styles = "";
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{
          __html: styles,
        }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ModernThemeProvider initialThemeId={themeId}>
        <ThemedProvider experience={experience}>{children}</ThemedProvider>
      </ModernThemeProvider>
    </CacheProvider>
  );
}

/**
 * Resolves the active Joy theme object. Classic gets its own theme; modern picks
 * the theme selected in `ModernThemeContext` (seeded from the server-resolved
 * preference). Runtime changes to either input can't repaint by themselves —
 * CssVarsProvider only generates its :root vars once — so theme/experience
 * switches persist the preference and reload (see ThemePicker/ThemeSwitcher).
 */
function ThemedProvider({
  experience,
  children,
}: PropsWithChildren<{ experience: ExperienceId }>) {
  const { themeId } = useModernTheme();
  const theme =
    experience === "classic" ? classicTheme : getModernTheme(themeId);

  return (
    <CssVarsProvider theme={theme}>
      <ThemePreferenceSync />
      <CssBaseline />
      <GlobalStyles
        styles={(theme) => ({
          ":root": {
            "--Collapsed-breakpoint": "769px",
            "--Cover-width": "40vw",
            "--Form-maxWidth": "700px",
            "--Transition-duration": "0.4s",
            "--Header-height": "4rem",
            [theme.breakpoints.up("md")]: {
              "--Header-height": "0px",
            },
          },
        })}
      />
      {children}
    </CssVarsProvider>
  );
}

function ThemePreferenceSync() {
  useThemePreferenceSync();
  return null;
}
