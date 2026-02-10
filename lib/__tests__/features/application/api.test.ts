import { describe, it, expect, vi } from "vitest";
import { applicationApi } from "@/lib/features/application/api";
import { describeApi } from "@/lib/test-utils";

// Mock the authentication client
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("applicationApi", () => {
  describeApi(applicationApi, {
    queries: ["getRightbar"],
    mutations: ["toggleRightbar"],
    reducerPath: "applicationApi",
  });

  describe("getRightbar endpoint", () => {
    it("should have getRightbar endpoint defined", () => {
      expect(applicationApi.endpoints.getRightbar).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(applicationApi.endpoints.getRightbar.initiate).toBeDefined();
      expect(typeof applicationApi.endpoints.getRightbar.initiate).toBe("function");
    });

    it("should have match methods for state changes", () => {
      expect(applicationApi.endpoints.getRightbar.matchFulfilled).toBeDefined();
      expect(applicationApi.endpoints.getRightbar.matchPending).toBeDefined();
      expect(applicationApi.endpoints.getRightbar.matchRejected).toBeDefined();
    });
  });

  describe("mutation endpoints", () => {
    it("should have toggleRightbar endpoint defined", () => {
      expect(applicationApi.endpoints.toggleRightbar).toBeDefined();
      expect(applicationApi.endpoints.toggleRightbar.initiate).toBeDefined();
    });
  });

  describe("API configuration", () => {
    it("should use applicationApi as reducer path", () => {
      expect(applicationApi.reducerPath).toBe("applicationApi");
    });

    it("should have reducer function", () => {
      expect(applicationApi.reducer).toBeDefined();
      expect(typeof applicationApi.reducer).toBe("function");
    });

    it("should have middleware function", () => {
      expect(applicationApi.middleware).toBeDefined();
      expect(typeof applicationApi.middleware).toBe("function");
    });
  });
});
