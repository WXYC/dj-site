import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import {
  useActiveExperience,
  useExperienceConfig,
  useIsExperience,
  useExperienceFeatures,
} from "@/lib/features/experiences/hooks";
import { EXPERIENCE_REGISTRY } from "@/lib/features/experiences/registry";
import type { ExperienceId } from "@/lib/features/experiences/types";

// Create a mock store for testing hooks
function createMockStore(applicationState: Record<string, unknown> = {}) {
  return configureStore({
    reducer: {
      application: (state = applicationState) => state,
    },
    preloadedState: {
      application: applicationState,
    },
  });
}

function createWrapper(applicationState: Record<string, unknown> = {}) {
  const store = createMockStore(applicationState);
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store, children });
  };
}

describe("experience hooks", () => {
  describe("useActiveExperience", () => {
    it("should return modern by default when no experience is set", () => {
      const wrapper = createWrapper({});
      const { result } = renderHook(() => useActiveExperience(), { wrapper });

      expect(result.current).toBe("modern");
    });

    it("should return experience from new state structure", () => {
      const wrapper = createWrapper({ experience: "classic" });
      const { result } = renderHook(() => useActiveExperience(), { wrapper });

      expect(result.current).toBe("classic");
    });

    it("should return modern when experience is set to modern", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useActiveExperience(), { wrapper });

      expect(result.current).toBe("modern");
    });

    it("should fall back to classic when old classic boolean is true", () => {
      const wrapper = createWrapper({ classic: true });
      const { result } = renderHook(() => useActiveExperience(), { wrapper });

      expect(result.current).toBe("classic");
    });

    it("should fall back to modern when old classic boolean is false", () => {
      const wrapper = createWrapper({ classic: false });
      const { result } = renderHook(() => useActiveExperience(), { wrapper });

      expect(result.current).toBe("modern");
    });

    it("should prefer new experience field over old classic field", () => {
      // When both exist, the new structure should take precedence
      const wrapper = createWrapper({ experience: "modern", classic: true });
      const { result } = renderHook(() => useActiveExperience(), { wrapper });

      expect(result.current).toBe("modern");
    });

    it("should return type ExperienceId", () => {
      const wrapper = createWrapper({ experience: "classic" });
      const { result } = renderHook(() => useActiveExperience(), { wrapper });

      // TypeScript type check - should be ExperienceId
      const experienceId: ExperienceId = result.current;
      expect(["classic", "modern"]).toContain(experienceId);
    });
  });

  describe("useExperienceConfig", () => {
    it("should return classic config when classic experience is active", () => {
      const wrapper = createWrapper({ experience: "classic" });
      const { result } = renderHook(() => useExperienceConfig(), { wrapper });

      expect(result.current).toEqual(EXPERIENCE_REGISTRY.classic);
      expect(result.current.id).toBe("classic");
      expect(result.current.name).toBe("Classic");
    });

    it("should return modern config when modern experience is active", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useExperienceConfig(), { wrapper });

      expect(result.current).toEqual(EXPERIENCE_REGISTRY.modern);
      expect(result.current.id).toBe("modern");
      expect(result.current.name).toBe("Modern");
    });

    it("should return modern config by default", () => {
      const wrapper = createWrapper({});
      const { result } = renderHook(() => useExperienceConfig(), { wrapper });

      expect(result.current.id).toBe("modern");
    });

    it("should return config with all expected properties", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useExperienceConfig(), { wrapper });

      expect(result.current).toHaveProperty("id");
      expect(result.current).toHaveProperty("name");
      expect(result.current).toHaveProperty("description");
      expect(result.current).toHaveProperty("icon");
      expect(result.current).toHaveProperty("enabled");
      expect(result.current).toHaveProperty("cssIdentifier");
      expect(result.current).toHaveProperty("features");
    });

    it("should return config with features object", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useExperienceConfig(), { wrapper });

      expect(result.current.features).toHaveProperty("hasRightbar");
      expect(result.current.features).toHaveProperty("hasLeftbar");
      expect(result.current.features).toHaveProperty("hasMobileHeader");
      expect(result.current.features).toHaveProperty("supportsThemeToggle");
    });

    it("should have correct features for classic experience", () => {
      const wrapper = createWrapper({ experience: "classic" });
      const { result } = renderHook(() => useExperienceConfig(), { wrapper });

      expect(result.current.features.hasRightbar).toBe(false);
      expect(result.current.features.hasLeftbar).toBe(false);
      expect(result.current.features.hasMobileHeader).toBe(false);
      expect(result.current.features.supportsThemeToggle).toBe(false);
    });

    it("should have correct features for modern experience", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useExperienceConfig(), { wrapper });

      expect(result.current.features.hasRightbar).toBe(true);
      expect(result.current.features.hasLeftbar).toBe(true);
      expect(result.current.features.hasMobileHeader).toBe(true);
      expect(result.current.features.supportsThemeToggle).toBe(true);
    });
  });

  describe("useIsExperience", () => {
    it("should return true when checking for the active experience", () => {
      const wrapper = createWrapper({ experience: "classic" });
      const { result } = renderHook(() => useIsExperience("classic"), {
        wrapper,
      });

      expect(result.current).toBe(true);
    });

    it("should return false when checking for a non-active experience", () => {
      const wrapper = createWrapper({ experience: "classic" });
      const { result } = renderHook(() => useIsExperience("modern"), {
        wrapper,
      });

      expect(result.current).toBe(false);
    });

    it("should return true for modern when modern is active", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useIsExperience("modern"), {
        wrapper,
      });

      expect(result.current).toBe(true);
    });

    it("should return false for classic when modern is active", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useIsExperience("classic"), {
        wrapper,
      });

      expect(result.current).toBe(false);
    });

    it("should return true for modern by default (when no experience set)", () => {
      const wrapper = createWrapper({});
      const { result } = renderHook(() => useIsExperience("modern"), {
        wrapper,
      });

      expect(result.current).toBe(true);
    });

    it("should return false for classic by default (when no experience set)", () => {
      const wrapper = createWrapper({});
      const { result } = renderHook(() => useIsExperience("classic"), {
        wrapper,
      });

      expect(result.current).toBe(false);
    });

    it("should work with legacy classic boolean state", () => {
      const wrapper = createWrapper({ classic: true });
      const { result } = renderHook(() => useIsExperience("classic"), {
        wrapper,
      });

      expect(result.current).toBe(true);
    });
  });

  describe("useExperienceFeatures", () => {
    it("should return features for modern experience", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useExperienceFeatures(), { wrapper });

      expect(result.current).toEqual(EXPERIENCE_REGISTRY.modern.features);
    });

    it("should return features for classic experience", () => {
      const wrapper = createWrapper({ experience: "classic" });
      const { result } = renderHook(() => useExperienceFeatures(), { wrapper });

      expect(result.current).toEqual(EXPERIENCE_REGISTRY.classic.features);
    });

    it("should return modern features by default", () => {
      const wrapper = createWrapper({});
      const { result } = renderHook(() => useExperienceFeatures(), { wrapper });

      expect(result.current.hasRightbar).toBe(true);
      expect(result.current.hasLeftbar).toBe(true);
      expect(result.current.hasMobileHeader).toBe(true);
      expect(result.current.supportsThemeToggle).toBe(true);
    });

    it("should have hasRightbar as boolean", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useExperienceFeatures(), { wrapper });

      expect(typeof result.current.hasRightbar).toBe("boolean");
    });

    it("should have hasLeftbar as boolean", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useExperienceFeatures(), { wrapper });

      expect(typeof result.current.hasLeftbar).toBe("boolean");
    });

    it("should have hasMobileHeader as boolean", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useExperienceFeatures(), { wrapper });

      expect(typeof result.current.hasMobileHeader).toBe("boolean");
    });

    it("should have supportsThemeToggle as boolean", () => {
      const wrapper = createWrapper({ experience: "modern" });
      const { result } = renderHook(() => useExperienceFeatures(), { wrapper });

      expect(typeof result.current.supportsThemeToggle).toBe("boolean");
    });

    it("should return classic features when using legacy classic boolean", () => {
      const wrapper = createWrapper({ classic: true });
      const { result } = renderHook(() => useExperienceFeatures(), { wrapper });

      expect(result.current.hasRightbar).toBe(false);
      expect(result.current.hasLeftbar).toBe(false);
    });
  });

  describe("hook composition", () => {
    it("useExperienceConfig should use result from useActiveExperience", () => {
      const wrapper = createWrapper({ experience: "classic" });

      const { result: experienceResult } = renderHook(
        () => useActiveExperience(),
        { wrapper }
      );
      const { result: configResult } = renderHook(() => useExperienceConfig(), {
        wrapper,
      });

      expect(configResult.current.id).toBe(experienceResult.current);
    });

    it("useExperienceFeatures should match useExperienceConfig features", () => {
      const wrapper = createWrapper({ experience: "modern" });

      const { result: configResult } = renderHook(() => useExperienceConfig(), {
        wrapper,
      });
      const { result: featuresResult } = renderHook(
        () => useExperienceFeatures(),
        { wrapper }
      );

      expect(featuresResult.current).toEqual(configResult.current.features);
    });

    it("useIsExperience should match useActiveExperience", () => {
      const wrapper = createWrapper({ experience: "classic" });

      const { result: activeResult } = renderHook(() => useActiveExperience(), {
        wrapper,
      });
      const { result: isClassicResult } = renderHook(
        () => useIsExperience("classic"),
        { wrapper }
      );
      const { result: isModernResult } = renderHook(
        () => useIsExperience("modern"),
        { wrapper }
      );

      expect(isClassicResult.current).toBe(activeResult.current === "classic");
      expect(isModernResult.current).toBe(activeResult.current === "modern");
    });
  });
});
