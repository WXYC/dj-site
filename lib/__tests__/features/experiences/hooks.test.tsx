import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useActiveExperience,
  useExperienceConfig,
  useIsExperience,
  useExperienceFeatures,
} from "@/lib/features/experiences/hooks";
import { applicationSlice } from "@/lib/features/application/frontend";
import { createHookWrapper } from "@/lib/test-utils";

function createWrapper(experience: string = "modern") {
  return createHookWrapper(
    { application: applicationSlice },
    { application: { ...applicationSlice.getInitialState(), experience } }
  );
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
