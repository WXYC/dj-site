import { describe, it, expect } from "vitest";
import {
  isColorMode,
  isAppSkinPreference,
  toAppSkinPreference,
  parseAppSkinPreference,
  getPreferenceFromAppState,
  APP_SKIN_STORAGE_KEY,
} from "@/lib/features/experiences/preferences";
import type { ApplicationState } from "@/lib/features/application/types";

describe("preferences", () => {
  describe("APP_SKIN_STORAGE_KEY", () => {
    it("should have the correct storage key", () => {
      expect(APP_SKIN_STORAGE_KEY).toBe("wxyc_app_skin");
    });
  });

  describe("isColorMode", () => {
    it.each([
      ["light", true],
      ["dark", true],
      ["Light", false],
      ["Dark", false],
      ["LIGHT", false],
      ["DARK", false],
      ["", false],
      [null, false],
      [undefined, false],
      [123, false],
      [{}, false],
      [[], false],
    ])('should return %s for value "%s"', (value, expected) => {
      expect(isColorMode(value)).toBe(expected);
    });
  });

  describe("isAppSkinPreference", () => {
    it.each([
      ["classic-light", true],
      ["classic-dark", true],
      ["modern-light", true],
      ["modern-dark", true],
      ["classic-Light", false],
      ["Classic-light", false],
      ["classic", false],
      ["light", false],
      ["invalid-light", false],
      ["modern-invalid", false],
      ["", false],
      [null, false],
      [undefined, false],
      [123, false],
      [{}, false],
    ])('should return %s for value "%s"', (value, expected) => {
      expect(isAppSkinPreference(value)).toBe(expected);
    });
  });

  describe("toAppSkinPreference", () => {
    it.each([
      ["classic", "light", "classic-light"],
      ["classic", "dark", "classic-dark"],
      ["modern", "light", "modern-light"],
      ["modern", "dark", "modern-dark"],
    ] as const)(
      'should create "%s" from experience "%s" and colorMode "%s"',
      (experience, colorMode, expected) => {
        expect(toAppSkinPreference(experience, colorMode)).toBe(expected);
      }
    );
  });

  describe("parseAppSkinPreference", () => {
    it.each([
      ["classic-light", { experience: "classic", colorMode: "light" }],
      ["classic-dark", { experience: "classic", colorMode: "dark" }],
      ["modern-light", { experience: "modern", colorMode: "light" }],
      ["modern-dark", { experience: "modern", colorMode: "dark" }],
    ] as const)(
      'should parse "%s" to %o',
      (value, expected) => {
        expect(parseAppSkinPreference(value)).toEqual(expected);
      }
    );

    it.each([
      "invalid",
      "classic",
      "light",
      "",
      null,
      undefined,
      123,
      "invalid-light",
      "modern-invalid",
    ])('should return null for invalid value "%s"', (value) => {
      expect(parseAppSkinPreference(value)).toBeNull();
    });
  });

  describe("getPreferenceFromAppState", () => {
    it("should return null for null state", () => {
      expect(getPreferenceFromAppState(null)).toBeNull();
    });

    it("should return null for undefined state", () => {
      expect(getPreferenceFromAppState(undefined)).toBeNull();
    });

    it("should return correct preference from application state", () => {
      const state: ApplicationState = {
        experience: "modern",
        colorMode: "dark",
        viewportSize: "lg",
        leftbarOpen: true,
        rightbarOpen: true,
        catalogOpen: true,
        mobileNavOpen: false,
        binOpen: false,
        rotationOpen: false,
        adminOpen: false,
        djInfoOpen: false,
        themeManuallySet: false,
        themeInProgress: false,
        showsCurrentShow: false,
      };
      expect(getPreferenceFromAppState(state)).toBe("modern-dark");
    });

    it("should handle classic experience with light mode", () => {
      const state: ApplicationState = {
        experience: "classic",
        colorMode: "light",
        viewportSize: "lg",
        leftbarOpen: true,
        rightbarOpen: true,
        catalogOpen: true,
        mobileNavOpen: false,
        binOpen: false,
        rotationOpen: false,
        adminOpen: false,
        djInfoOpen: false,
        themeManuallySet: false,
        themeInProgress: false,
        showsCurrentShow: false,
      };
      expect(getPreferenceFromAppState(state)).toBe("classic-light");
    });
  });
});
