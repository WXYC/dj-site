import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { applicationSlice } from "@/lib/features/application/frontend";
import React from "react";

// Mock registry
vi.mock("@/lib/features/experiences/registry", () => ({
  getExperienceConfig: vi.fn((id: string) => ({
    id,
    name: id === "modern" ? "Modern" : "Classic",
    enabled: true,
    features: {
      modernUI: id === "modern",
      classicUI: id === "classic",
    },
  })),
}));

// Import after mocks
import {
  useActiveExperience,
  useExperienceConfig,
  useIsExperience,
  useExperienceFeatures,
} from "@/lib/features/experiences/hooks";

function createTestStore(preloadedState?: any) {
  return configureStore({
    reducer: {
      application: applicationSlice.reducer,
    },
    preloadedState,
  });
}

function createWrapper(store: ReturnType<typeof createTestStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  };
}

describe("experiences hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useActiveExperience", () => {
    it("should return modern when experience is modern", () => {
      const store = createTestStore({
        application: { experience: "modern", colorMode: "light" },
      });

      const { result } = renderHook(() => useActiveExperience(), {
        wrapper: createWrapper(store),
      });

      expect(result.current).toBe("modern");
    });

    it("should return classic when experience is classic", () => {
      const store = createTestStore({
        application: { experience: "classic", colorMode: "light" },
      });

      const { result } = renderHook(() => useActiveExperience(), {
        wrapper: createWrapper(store),
      });

      expect(result.current).toBe("classic");
    });

    it("should fall back to modern when no experience set", () => {
      const store = createTestStore({
        application: { colorMode: "light" },
      });

      const { result } = renderHook(() => useActiveExperience(), {
        wrapper: createWrapper(store),
      });

      expect(result.current).toBe("modern");
    });

    it("should handle legacy classic boolean true", () => {
      const store = createTestStore({
        application: { classic: true },
      });

      const { result } = renderHook(() => useActiveExperience(), {
        wrapper: createWrapper(store),
      });

      expect(result.current).toBe("classic");
    });

    it("should handle legacy classic boolean false", () => {
      const store = createTestStore({
        application: { classic: false },
      });

      const { result } = renderHook(() => useActiveExperience(), {
        wrapper: createWrapper(store),
      });

      expect(result.current).toBe("modern");
    });
  });

  describe("useExperienceConfig", () => {
    it("should return config for modern experience", () => {
      const store = createTestStore({
        application: { experience: "modern", colorMode: "light" },
      });

      const { result } = renderHook(() => useExperienceConfig(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.id).toBe("modern");
      expect(result.current.name).toBe("Modern");
    });

    it("should return config for classic experience", () => {
      const store = createTestStore({
        application: { experience: "classic", colorMode: "light" },
      });

      const { result } = renderHook(() => useExperienceConfig(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.id).toBe("classic");
      expect(result.current.name).toBe("Classic");
    });
  });

  describe("useIsExperience", () => {
    it("should return true when checking active experience", () => {
      const store = createTestStore({
        application: { experience: "modern", colorMode: "light" },
      });

      const { result } = renderHook(() => useIsExperience("modern"), {
        wrapper: createWrapper(store),
      });

      expect(result.current).toBe(true);
    });

    it("should return false when checking inactive experience", () => {
      const store = createTestStore({
        application: { experience: "modern", colorMode: "light" },
      });

      const { result } = renderHook(() => useIsExperience("classic"), {
        wrapper: createWrapper(store),
      });

      expect(result.current).toBe(false);
    });
  });

  describe("useExperienceFeatures", () => {
    it("should return features for modern experience", () => {
      const store = createTestStore({
        application: { experience: "modern", colorMode: "light" },
      });

      const { result } = renderHook(() => useExperienceFeatures(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.modernUI).toBe(true);
    });

    it("should return features for classic experience", () => {
      const store = createTestStore({
        application: { experience: "classic", colorMode: "light" },
      });

      const { result } = renderHook(() => useExperienceFeatures(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.classicUI).toBe(true);
    });
  });
});
