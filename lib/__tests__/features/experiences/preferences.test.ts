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
      "modern-light",
      "modern-dark",
      // 3-part modern theme form
      "modern-ocean-light",
      "modern-ocean-dark",
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
      { experience: "modern" as const, colorMode: "light" as const, themeId: undefined, expected: "modern-light" },
      { experience: "modern" as const, colorMode: "dark" as const, themeId: undefined, expected: "modern-dark" },
      // default theme emits the legacy 2-part form (back-compat with old clients)
      { experience: "modern" as const, colorMode: "light" as const, themeId: "default", expected: "modern-light" },
      // non-default theme emits the 3-part form
      { experience: "modern" as const, colorMode: "dark" as const, themeId: "ocean", expected: "modern-ocean-dark" },
      // classic ignores the theme axis
      { experience: "classic" as const, colorMode: "light" as const, themeId: "ocean", expected: "classic-light" },
    ])(
      "should return $expected for $experience + $colorMode + $themeId",
      ({ experience, colorMode, themeId, expected }) => {
        expect(toAppSkinPreference(experience, colorMode, themeId)).toBe(expected);
      }
    );
  });

  describe("parseAppSkinPreference", () => {
    it.each([
      { input: "classic-light", experience: "classic", colorMode: "light", themeId: "default" },
      { input: "classic-dark", experience: "classic", colorMode: "dark", themeId: "default" },
      { input: "modern-light", experience: "modern", colorMode: "light", themeId: "default" },
      { input: "modern-dark", experience: "modern", colorMode: "dark", themeId: "default" },
      // legacy 2-part modern → default theme
      { input: "modern-ocean-light", experience: "modern", colorMode: "light", themeId: "ocean" },
      { input: "modern-sunset-dark", experience: "modern", colorMode: "dark", themeId: "sunset" },
    ])(
      'should parse "$input" into experience=$experience colorMode=$colorMode themeId=$themeId',
      ({ input, experience, colorMode, themeId }) => {
        const result = parseAppSkinPreference(input);
        expect(result).toEqual({ experience, colorMode, themeId });
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
    ])("should return null for invalid input %s", (value) => {
      expect(parseAppSkinPreference(value)).toBeNull();
    });
  });

  describe("getPreferenceFromAppState", () => {
    it("should return preference from valid app state", () => {
      const state: ApplicationState = {
        experience: "modern",
        colorMode: "dark",
        themeId: "default",
        rightBarMini: true,
      };
      expect(getPreferenceFromAppState(state)).toBe("modern-dark");
    });

    it("should emit the 3-part form for a non-default modern theme", () => {
      const state: ApplicationState = {
        experience: "modern",
        colorMode: "light",
        themeId: "ocean",
        rightBarMini: true,
      };
      expect(getPreferenceFromAppState(state)).toBe("modern-ocean-light");
    });

    it("should return preference for classic light state", () => {
      const state: ApplicationState = {
        experience: "classic",
        colorMode: "light",
        themeId: "default",
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
