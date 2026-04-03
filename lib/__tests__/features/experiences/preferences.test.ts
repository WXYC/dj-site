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
    ])("should return false for %s", (value) => {
      expect(isAppSkinPreference(value)).toBe(false);
    });
  });

  describe("toAppSkinPreference", () => {
    it.each([
      { experience: "classic" as const, colorMode: "light" as const, expected: "classic-light" },
      { experience: "classic" as const, colorMode: "dark" as const, expected: "classic-dark" },
      { experience: "modern" as const, colorMode: "light" as const, expected: "modern-light" },
      { experience: "modern" as const, colorMode: "dark" as const, expected: "modern-dark" },
    ])(
      "should return $expected for $experience + $colorMode",
      ({ experience, colorMode, expected }) => {
        expect(toAppSkinPreference(experience, colorMode)).toBe(expected);
      }
    );
  });

  describe("parseAppSkinPreference", () => {
    it.each([
      { input: "classic-light", experience: "classic", colorMode: "light" },
      { input: "classic-dark", experience: "classic", colorMode: "dark" },
      { input: "modern-light", experience: "modern", colorMode: "light" },
      { input: "modern-dark", experience: "modern", colorMode: "dark" },
    ])(
      'should parse "$input" into experience=$experience and colorMode=$colorMode',
      ({ input, experience, colorMode }) => {
        const result = parseAppSkinPreference(input);
        expect(result).toEqual({ experience, colorMode });
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
        rightBarMini: true,
      };
      expect(getPreferenceFromAppState(state)).toBe("modern-dark");
    });

    it("should return preference for classic light state", () => {
      const state: ApplicationState = {
        experience: "classic",
        colorMode: "light",
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
