import { describe, it, expect, vi } from "vitest";
import { experienceApi } from "@/lib/features/experiences/api";
import { describeApi } from "@/lib/test-utils";

// Mock the authentication client
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("experienceApi", () => {
  describeApi(experienceApi, {
    queries: ["getActiveExperience"],
    mutations: ["switchExperience", "setExperiencePreference"],
    reducerPath: "experienceApi",
  });

  describe("getActiveExperience endpoint", () => {
    it("should have getActiveExperience endpoint defined", () => {
      expect(experienceApi.endpoints.getActiveExperience).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(experienceApi.endpoints.getActiveExperience.initiate).toBeDefined();
      expect(typeof experienceApi.endpoints.getActiveExperience.initiate).toBe("function");
    });

    it("should have match methods for state changes", () => {
      expect(experienceApi.endpoints.getActiveExperience.matchFulfilled).toBeDefined();
      expect(experienceApi.endpoints.getActiveExperience.matchPending).toBeDefined();
      expect(experienceApi.endpoints.getActiveExperience.matchRejected).toBeDefined();
    });
  });

  describe("mutation endpoints", () => {
    it("should have switchExperience endpoint defined", () => {
      expect(experienceApi.endpoints.switchExperience).toBeDefined();
      expect(experienceApi.endpoints.switchExperience.initiate).toBeDefined();
    });

    it("should have setExperiencePreference endpoint defined", () => {
      expect(experienceApi.endpoints.setExperiencePreference).toBeDefined();
      expect(experienceApi.endpoints.setExperiencePreference.initiate).toBeDefined();
    });
  });

  describe("API configuration", () => {
    it("should use experienceApi as reducer path", () => {
      expect(experienceApi.reducerPath).toBe("experienceApi");
    });

    it("should have reducer function", () => {
      expect(experienceApi.reducer).toBeDefined();
      expect(typeof experienceApi.reducer).toBe("function");
    });

    it("should have middleware function", () => {
      expect(experienceApi.middleware).toBeDefined();
      expect(typeof experienceApi.middleware).toBe("function");
    });
  });
});
