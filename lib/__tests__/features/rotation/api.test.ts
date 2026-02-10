import { describe, it, expect, vi } from "vitest";
import { rotationApi } from "@/lib/features/rotation/api";
import { describeApi } from "@/lib/test-utils";

// Mock the authentication client
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("rotationApi", () => {
  describeApi(rotationApi, {
    queries: ["getRotation"],
    mutations: ["addRotationEntry", "killRotationEntry"],
    reducerPath: "rotationApi",
  });

  describe("getRotation endpoint", () => {
    it("should have getRotation endpoint defined", () => {
      expect(rotationApi.endpoints.getRotation).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(rotationApi.endpoints.getRotation.initiate).toBeDefined();
      expect(typeof rotationApi.endpoints.getRotation.initiate).toBe("function");
    });

    it("should have match methods for state changes", () => {
      expect(rotationApi.endpoints.getRotation.matchFulfilled).toBeDefined();
      expect(rotationApi.endpoints.getRotation.matchPending).toBeDefined();
      expect(rotationApi.endpoints.getRotation.matchRejected).toBeDefined();
    });
  });

  describe("mutation endpoints", () => {
    it("should have addRotationEntry endpoint defined", () => {
      expect(rotationApi.endpoints.addRotationEntry).toBeDefined();
      expect(rotationApi.endpoints.addRotationEntry.initiate).toBeDefined();
    });

    it("should have killRotationEntry endpoint defined", () => {
      expect(rotationApi.endpoints.killRotationEntry).toBeDefined();
      expect(rotationApi.endpoints.killRotationEntry.initiate).toBeDefined();
    });
  });

  describe("API configuration", () => {
    it("should use rotationApi as reducer path", () => {
      expect(rotationApi.reducerPath).toBe("rotationApi");
    });

    it("should have reducer function", () => {
      expect(rotationApi.reducer).toBeDefined();
      expect(typeof rotationApi.reducer).toBe("function");
    });

    it("should have middleware function", () => {
      expect(rotationApi.middleware).toBeDefined();
      expect(typeof rotationApi.middleware).toBe("function");
    });
  });
});
