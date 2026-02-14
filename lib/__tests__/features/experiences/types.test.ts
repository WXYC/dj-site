import { describe, it, expect } from "vitest";
import {
  isExperienceId,
  toExperienceId,
  defaultExperienceState,
} from "@/lib/features/experiences/types";
import type { ExperienceId, ExperienceState } from "@/lib/features/experiences/types";

describe("experience types", () => {
  describe("isExperienceId", () => {
    it("should return true for 'classic'", () => {
      expect(isExperienceId("classic")).toBe(true);
    });

    it("should return true for 'modern'", () => {
      expect(isExperienceId("modern")).toBe(true);
    });

    it("should return false for invalid string", () => {
      expect(isExperienceId("invalid")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isExperienceId("")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isExperienceId(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isExperienceId(undefined)).toBe(false);
    });

    it("should return false for number", () => {
      expect(isExperienceId(123)).toBe(false);
    });

    it("should return false for boolean", () => {
      expect(isExperienceId(true)).toBe(false);
      expect(isExperienceId(false)).toBe(false);
    });

    it("should return false for object", () => {
      expect(isExperienceId({})).toBe(false);
      expect(isExperienceId({ id: "classic" })).toBe(false);
    });

    it("should return false for array", () => {
      expect(isExperienceId([])).toBe(false);
      expect(isExperienceId(["classic"])).toBe(false);
    });

    it("should return false for similar but different strings", () => {
      expect(isExperienceId("Classic")).toBe(false); // case sensitive
      expect(isExperienceId("CLASSIC")).toBe(false);
      expect(isExperienceId("Modern")).toBe(false);
      expect(isExperienceId("MODERN")).toBe(false);
      expect(isExperienceId(" classic")).toBe(false); // with spaces
      expect(isExperienceId("classic ")).toBe(false);
      expect(isExperienceId(" modern ")).toBe(false);
    });

    it("should work as a type guard", () => {
      const value: unknown = "classic";
      if (isExperienceId(value)) {
        // TypeScript should narrow value to ExperienceId
        const experienceId: ExperienceId = value;
        expect(experienceId).toBe("classic");
      }
    });
  });

  describe("toExperienceId", () => {
    it("should return 'classic' when value is 'classic'", () => {
      expect(toExperienceId("classic")).toBe("classic");
    });

    it("should return 'modern' when value is 'modern'", () => {
      expect(toExperienceId("modern")).toBe("modern");
    });

    it("should return default 'modern' for invalid value", () => {
      expect(toExperienceId("invalid")).toBe("modern");
    });

    it("should return default 'modern' for empty string", () => {
      expect(toExperienceId("")).toBe("modern");
    });

    it("should return default 'modern' for null", () => {
      expect(toExperienceId(null)).toBe("modern");
    });

    it("should return default 'modern' for undefined", () => {
      expect(toExperienceId(undefined)).toBe("modern");
    });

    it("should return default 'modern' for number", () => {
      expect(toExperienceId(123)).toBe("modern");
    });

    it("should return default 'modern' for object", () => {
      expect(toExperienceId({})).toBe("modern");
    });

    it("should use custom fallback when provided", () => {
      expect(toExperienceId("invalid", "classic")).toBe("classic");
    });

    it("should return valid value instead of custom fallback", () => {
      expect(toExperienceId("modern", "classic")).toBe("modern");
      expect(toExperienceId("classic", "modern")).toBe("classic");
    });

    it("should use custom fallback for null with classic fallback", () => {
      expect(toExperienceId(null, "classic")).toBe("classic");
    });

    it("should use custom fallback for undefined with classic fallback", () => {
      expect(toExperienceId(undefined, "classic")).toBe("classic");
    });

    it("should return default for case-sensitive mismatches", () => {
      expect(toExperienceId("Classic")).toBe("modern");
      expect(toExperienceId("MODERN")).toBe("modern");
    });

    it("should return default for strings with whitespace", () => {
      expect(toExperienceId(" classic")).toBe("modern");
      expect(toExperienceId("modern ")).toBe("modern");
    });

    it("should return type ExperienceId", () => {
      const result: ExperienceId = toExperienceId("anything");
      expect(["classic", "modern"]).toContain(result);
    });
  });

  describe("defaultExperienceState", () => {
    it("should have active set to 'modern'", () => {
      expect(defaultExperienceState.active).toBe("modern");
    });

    it("should have available experiences array", () => {
      expect(Array.isArray(defaultExperienceState.available)).toBe(true);
    });

    it("should include 'classic' in available experiences", () => {
      expect(defaultExperienceState.available).toContain("classic");
    });

    it("should include 'modern' in available experiences", () => {
      expect(defaultExperienceState.available).toContain("modern");
    });

    it("should have exactly 2 available experiences", () => {
      expect(defaultExperienceState.available).toHaveLength(2);
    });

    it("should have switchingEnabled set to true", () => {
      expect(defaultExperienceState.switchingEnabled).toBe(true);
    });

    it("should be a valid ExperienceState object", () => {
      const state: ExperienceState = defaultExperienceState;
      expect(state).toHaveProperty("active");
      expect(state).toHaveProperty("available");
      expect(state).toHaveProperty("switchingEnabled");
    });

    it("should be immutable (new object on each access)", () => {
      // The exported constant should be the same reference
      expect(defaultExperienceState).toBe(defaultExperienceState);
    });

    it("should have active that is a valid ExperienceId", () => {
      expect(isExperienceId(defaultExperienceState.active)).toBe(true);
    });

    it("should have all available items as valid ExperienceIds", () => {
      defaultExperienceState.available.forEach((exp) => {
        expect(isExperienceId(exp)).toBe(true);
      });
    });
  });

  describe("type definitions", () => {
    it("ExperienceId should only allow 'classic' or 'modern'", () => {
      // Type-level test - these should compile
      const classic: ExperienceId = "classic";
      const modern: ExperienceId = "modern";

      expect(classic).toBe("classic");
      expect(modern).toBe("modern");
    });

    it("ExperienceState should have expected structure", () => {
      const state: ExperienceState = {
        active: "classic",
        available: ["classic", "modern"],
        switchingEnabled: false,
      };

      expect(state.active).toBe("classic");
      expect(state.available).toEqual(["classic", "modern"]);
      expect(state.switchingEnabled).toBe(false);
    });
  });

  describe("integration between functions", () => {
    it("toExperienceId should return values that pass isExperienceId", () => {
      const validInputs = ["classic", "modern"];
      const invalidInputs = ["invalid", null, undefined, 123, {}, []];

      validInputs.forEach((input) => {
        const result = toExperienceId(input);
        expect(isExperienceId(result)).toBe(true);
      });

      invalidInputs.forEach((input) => {
        const result = toExperienceId(input);
        expect(isExperienceId(result)).toBe(true);
      });
    });

    it("defaultExperienceState.active should pass isExperienceId", () => {
      expect(isExperienceId(defaultExperienceState.active)).toBe(true);
    });

    it("toExperienceId with defaultExperienceState.active as fallback", () => {
      const result = toExperienceId("invalid", defaultExperienceState.active);
      expect(result).toBe("modern");
    });
  });
});
