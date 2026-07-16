import { describe, it, expect, vi } from "vitest";
import type { Theme } from "@mui/joy/styles";

vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import {
  DEFAULT_MODERN_THEME_ID,
  MODERN_THEMES,
  MODERN_THEME_LIST,
  getModernTheme,
  getThemeSwatches,
  isModernThemeId,
  resolveModernThemeId,
} from "@/lib/features/experiences/modern/themes";

// Runtime access to variants keyed by custom palette slots (typed away by Joy).
const variantGroup = (theme: Theme, variant: string): Record<string, unknown> =>
  (theme.variants as unknown as Record<string, Record<string, unknown>>)[variant];

describe("modern theme registry", () => {
  it("registers the default theme", () => {
    expect(MODERN_THEMES[DEFAULT_MODERN_THEME_ID]).toBeDefined();
    expect(isModernThemeId(DEFAULT_MODERN_THEME_ID)).toBe(true);
  });

  it("every registered theme has a valid id and both schemes", () => {
    for (const def of MODERN_THEME_LIST) {
      expect(def.id).toMatch(/^[a-z0-9]+$/);
      expect(def.schemes.light).toBeDefined();
      expect(def.schemes.dark).toBeDefined();
      // Required semantic slots present in both schemes.
      for (const scheme of [def.schemes.light, def.schemes.dark]) {
        expect(scheme.sidebar).toBeDefined();
        expect(scheme.sidebarAdmin).toBeDefined();
        expect(scheme.formatVinyl).toBeDefined();
        expect(scheme.formatCd).toBeDefined();
        expect(scheme.exclusive.solidBg).toBeTruthy();
        expect(scheme.onAir.indicator).toBeTruthy();
        expect(scheme.rotation.heavy).toBeDefined();
        expect(scheme.rotation.singles).toBeDefined();
      }
    }
  });

  it("resolves unknown/invalid ids to the default", () => {
    expect(resolveModernThemeId("does-not-exist")).toBe(DEFAULT_MODERN_THEME_ID);
    expect(resolveModernThemeId("Has-Dashes")).toBe(DEFAULT_MODERN_THEME_ID);
    expect(resolveModernThemeId(undefined)).toBe(DEFAULT_MODERN_THEME_ID);
    // A retired id (e.g. an old theme name) is unrecognized → default.
    expect(resolveModernThemeId("solarized")).toBe(DEFAULT_MODERN_THEME_ID);
    expect(isModernThemeId("nope")).toBe(false);
  });

  it("memoizes built themes per id", () => {
    expect(getModernTheme("default")).toBe(getModernTheme("default"));
  });

  it("produces variant styles for the custom sidebar/format slots", () => {
    const theme = getModernTheme("default");
    expect(variantGroup(theme, "solid").sidebar).toBeDefined();
    expect(variantGroup(theme, "soft").sidebar).toBeDefined();
    expect(variantGroup(theme, "soft").sidebarAdmin).toBeDefined();
    expect(variantGroup(theme, "soft").formatVinyl).toBeDefined();
    expect(variantGroup(theme, "soft").formatCd).toBeDefined();
  });

  it("exposes semantic token CSS variables", () => {
    const theme = getModernTheme("default");
    const palette = theme.vars.palette as Record<string, any>;
    expect(palette.rotation.heavy.bg).toContain("--wxyc-palette-rotation-heavy-bg");
    expect(palette.exclusive.solidBg).toContain("--wxyc-palette-exclusive-solidBg");
    expect(palette.onAir.indicator).toContain("--wxyc-palette-onAir-indicator");
    expect(palette.sidebar.solidBg).toContain("--wxyc-palette-sidebar-solidBg");
  });

  it("derives four swatches for the picker in both modes", () => {
    for (const def of MODERN_THEME_LIST) {
      expect(getThemeSwatches(def, "light")).toHaveLength(4);
      expect(getThemeSwatches(def, "dark")).toHaveLength(4);
    }
  });
});
