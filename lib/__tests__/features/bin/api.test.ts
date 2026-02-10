import { describe, it, expect, vi } from "vitest";
import { binApi } from "@/lib/features/bin/api";
import { describeApi } from "@/lib/test-utils";

// Mock the authentication client
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("binApi", () => {
  describeApi(binApi, {
    queries: ["getBin"],
    mutations: ["deleteFromBin", "addToBin"],
    reducerPath: "binApi",
  });

  describe("getBin endpoint", () => {
    it("should have getBin endpoint defined", () => {
      expect(binApi.endpoints.getBin).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(binApi.endpoints.getBin.initiate).toBeDefined();
      expect(typeof binApi.endpoints.getBin.initiate).toBe("function");
    });

    it("should have match methods for state changes", () => {
      expect(binApi.endpoints.getBin.matchFulfilled).toBeDefined();
      expect(binApi.endpoints.getBin.matchPending).toBeDefined();
      expect(binApi.endpoints.getBin.matchRejected).toBeDefined();
    });
  });

  describe("mutation endpoints", () => {
    it("should have deleteFromBin endpoint defined", () => {
      expect(binApi.endpoints.deleteFromBin).toBeDefined();
      expect(binApi.endpoints.deleteFromBin.initiate).toBeDefined();
    });

    it("should have addToBin endpoint defined", () => {
      expect(binApi.endpoints.addToBin).toBeDefined();
      expect(binApi.endpoints.addToBin.initiate).toBeDefined();
    });
  });

  describe("API configuration", () => {
    it("should use binApi as reducer path", () => {
      expect(binApi.reducerPath).toBe("binApi");
    });

    it("should have reducer function", () => {
      expect(binApi.reducer).toBeDefined();
      expect(typeof binApi.reducer).toBe("function");
    });

    it("should have middleware function", () => {
      expect(binApi.middleware).toBeDefined();
      expect(typeof binApi.middleware).toBe("function");
    });
  });
});
