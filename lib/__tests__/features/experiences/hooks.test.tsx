import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import {
  useActiveExperience,
  useExperienceConfig,
  useIsExperience,
  useExperienceFeatures,
} from "@/lib/features/experiences/hooks";
import { applicationSlice } from "@/lib/features/application/frontend";

function createTestStore(experience: string = "modern") {
  return configureStore({
    reducer: {
      application: applicationSlice.reducer,
    },
    preloadedState: {
      application: {
        ...applicationSlice.getInitialState(),
        experience,
      } as any,
    },
  });
}

function createWrapper(experience: string = "modern") {
  const store = createTestStore(experience);
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("useActiveExperience", () => {
  it("should return modern when experience is modern", () => {
    const { result } = renderHook(() => useActiveExperience(), {
      wrapper: createWrapper("modern"),
    });
    expect(result.current).toBe("modern");
  });

  it("should return classic when experience is classic", () => {
    const { result } = renderHook(() => useActiveExperience(), {
      wrapper: createWrapper("classic"),
    });
    expect(result.current).toBe("classic");
  });
});

describe("useExperienceConfig", () => {
  it("should return config for current experience", () => {
    const { result } = renderHook(() => useExperienceConfig(), {
      wrapper: createWrapper("modern"),
    });
    expect(result.current).toBeDefined();
    expect(result.current.id).toBe("modern");
  });
});

describe("useIsExperience", () => {
  it("should return true when checking current experience", () => {
    const { result } = renderHook(() => useIsExperience("modern"), {
      wrapper: createWrapper("modern"),
    });
    expect(result.current).toBe(true);
  });

  it("should return false when checking different experience", () => {
    const { result } = renderHook(() => useIsExperience("classic"), {
      wrapper: createWrapper("modern"),
    });
    expect(result.current).toBe(false);
  });
});

describe("useExperienceFeatures", () => {
  it("should return features object", () => {
    const { result } = renderHook(() => useExperienceFeatures(), {
      wrapper: createWrapper("modern"),
    });
    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe("object");
  });
});
