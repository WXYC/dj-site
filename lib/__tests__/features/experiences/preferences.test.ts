import { describe, it, expect } from "vitest";
import {
  isAppSkinPreference,
  parseAppSkinPreference,
  toAppSkinPreference,
  getPreferenceFromAppState,
  isColorMode,
} from "@/lib/features/experiences/preferences";
import type { ApplicationState } from "@/lib/features/application/types";

describe("preferences", () => {
  describe("isColorMode", () => {
    it.each(["light", "dark"])('should return true for "%s"', (value) => {
      expect(isColorMode(value)).toBe(true);
    });

    it.each([
      "Light",
      "DARK",
      "auto",
      "",
      null,
      undefined,
      42,
      true,
    ])("should return false for %s", (value) => {
      expect(isColorMode(value)).toBe(false);
    });
  });

  describe("isAppSkinPreference", () => {
    it.each([
      "classic-light",
      "classic-dark",
      // legacy 2-part modern still parses (heals to the default theme)
      "modern-light",
      "modern-dark",
      // 3-part modern theme form
      "modern-bluenote-light",
      "modern-deadstock-dark",
      // well-formed but unknown theme id still parses (resolution degrades later)
      "modern-sunset-light",
    ])('should return true for "%s"', (value) => {
      expect(isAppSkinPreference(value)).toBe(true);
    });

    it.each([
      "classic",
      "modern",
      "light",
      "dark",
      "classic-auto",
      "future-light",
      "",
      null,
      undefined,
      42,
      true,
      "classic-light-extra",
      // theme axis is modern-only
      "classic-ocean-light",
      // last token must be a color mode
      "modern-ocean-auto",
      // theme ids are dash-free / lowercase-alnum
      "modern-Ocean-light",
    ])("should return false for %s", (value) => {
      expect(isAppSkinPreference(value)).toBe(false);
    });
  });

  describe("toAppSkinPreference", () => {
    it.each([
      { experience: "classic" as const, colorMode: "light" as const, themeId: undefined, expected: "classic-light" },
      { experience: "classic" as const, colorMode: "dark" as const, themeId: undefined, expected: "classic-dark" },
      // modern always emits the 3-part form with a resolved (real) theme id
      { experience: "modern" as const, colorMode: "light" as const, themeId: undefined, expected: "modern-stacks-light" },
      { experience: "modern" as const, colorMode: "dark" as const, themeId: undefined, expected: "modern-stacks-dark" },
      { experience: "modern" as const, colorMode: "light" as const, themeId: "stacks", expected: "modern-stacks-light" },
      { experience: "modern" as const, colorMode: "dark" as const, themeId: "deadstock", expected: "modern-deadstock-dark" },
      // any unrecognized id → default
      { experience: "modern" as const, colorMode: "dark" as const, themeId: "solarized", expected: "modern-stacks-dark" },
      { experience: "modern" as const, colorMode: "light" as const, themeId: "ocean", expected: "modern-stacks-light" },
      // classic ignores the theme axis
      { experience: "classic" as const, colorMode: "light" as const, themeId: "deadstock", expected: "classic-light" },
    ])(
      "should return $expected for $experience + $colorMode + $themeId",
      ({ experience, colorMode, themeId, expected }) => {
        expect(toAppSkinPreference(experience, colorMode, themeId)).toBe(expected);
      }
    );
  });

  describe("parseAppSkinPreference", () => {
    it.each([
      // already canonical → no rewrite
      { input: "classic-light", experience: "classic", colorMode: "light", themeId: "stacks", canonical: "classic-light", needsRewrite: false },
      { input: "classic-dark", experience: "classic", colorMode: "dark", themeId: "stacks", canonical: "classic-dark", needsRewrite: false },
      { input: "modern-stacks-light", experience: "modern", colorMode: "light", themeId: "stacks", canonical: "modern-stacks-light", needsRewrite: false },
      { input: "modern-deadstock-dark", experience: "modern", colorMode: "dark", themeId: "deadstock", canonical: "modern-deadstock-dark", needsRewrite: false },
      // legacy 2-part modern → default theme, flagged for rewrite
      { input: "modern-light", experience: "modern", colorMode: "light", themeId: "stacks", canonical: "modern-stacks-light", needsRewrite: true },
      // unrecognized id → default, flagged for rewrite
      { input: "modern-solarized-dark", experience: "modern", colorMode: "dark", themeId: "stacks", canonical: "modern-stacks-dark", needsRewrite: true },
      { input: "modern-ocean-light", experience: "modern", colorMode: "light", themeId: "stacks", canonical: "modern-stacks-light", needsRewrite: true },
    ])(
      'should parse "$input" → $canonical (rewrite=$needsRewrite)',
      ({ input, experience, colorMode, themeId, canonical, needsRewrite }) => {
        expect(parseAppSkinPreference(input)).toEqual({
          experience,
          colorMode,
          themeId,
          canonical,
          needsRewrite,
        });
      }
    );

    it.each([
      "invalid",
      "classic",
      "modern-auto",
      "",
      null,
      undefined,
      42,
      "classic-light-extra",
      "classic-ocean-light",
      "modern-Ocean-light",
    ])("should return null for invalid input %s", (value) => {
      expect(parseAppSkinPreference(value)).toBeNull();
    });
  });

  describe("getPreferenceFromAppState", () => {
    it("should return the canonical preference from valid app state", () => {
      const state: ApplicationState = {
        experience: "modern",
        colorMode: "dark",
        themeId: "stacks",
        rightBarMini: true,
      };
      expect(getPreferenceFromAppState(state)).toBe("modern-stacks-dark");
    });

    it("should emit the 3-part form for a non-default modern theme", () => {
      const state: ApplicationState = {
        experience: "modern",
        colorMode: "light",
        themeId: "deadstock",
        rightBarMini: true,
      };
      expect(getPreferenceFromAppState(state)).toBe("modern-deadstock-light");
    });

    it("should heal an unrecognized theme id stored in app state", () => {
      const state: ApplicationState = {
        experience: "modern",
        colorMode: "light",
        themeId: "solarized",
        rightBarMini: true,
      };
      expect(getPreferenceFromAppState(state)).toBe("modern-stacks-light");
    });

    it("should return preference for classic light state", () => {
      const state: ApplicationState = {
        experience: "classic",
        colorMode: "light",
        themeId: "stacks",
        rightBarMini: false,
      };
      expect(getPreferenceFromAppState(state)).toBe("classic-light");
    });

    it("should return null for null state", () => {
      expect(getPreferenceFromAppState(null)).toBeNull();
    });

    it("should return null for undefined state", () => {
      expect(getPreferenceFromAppState(undefined)).toBeNull();
    });
  });
});
