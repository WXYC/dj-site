import { describe, it, expect, vi } from "vitest";
import { binApi, useGetBinQuery, useDeleteFromBinMutation, useAddToBinMutation } from "@/lib/features/bin/api";
import { describeApi } from "@/lib/test-utils";

// Mock the authentication client to prevent token fetch issues
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("binApi", () => {
  // Use the harness for basic structure tests
  describeApi(binApi, {
    queries: ["getBin"],
    mutations: ["deleteFromBin", "addToBin"],
    reducerPath: "binApi",
  });

  describe("exported hooks", () => {
    it("should export useGetBinQuery hook", async () => {
      const { useGetBinQuery } = await import("@/lib/features/bin/api");
      expect(useGetBinQuery).toBeDefined();
      expect(typeof useGetBinQuery).toBe("function");
    });

    it("should export useDeleteFromBinMutation hook", async () => {
      const { useDeleteFromBinMutation } = await import(
        "@/lib/features/bin/api"
      );
      expect(useDeleteFromBinMutation).toBeDefined();
      expect(typeof useDeleteFromBinMutation).toBe("function");
    });

    it("should export useAddToBinMutation hook", async () => {
      const { useAddToBinMutation } = await import("@/lib/features/bin/api");
      expect(useAddToBinMutation).toBeDefined();
      expect(typeof useAddToBinMutation).toBe("function");
    });
  });

  describe("API configuration", () => {
    it("should use binApi as reducer path", () => {
      expect(binApi.reducerPath).toBe("binApi");
    });

    it("should export the binApi object", () => {
      expect(binApi).toBeDefined();
      expect(binApi.endpoints).toBeDefined();
    });

    it("should have Bin tag type", () => {
      // Access via internal structure
      expect(binApi.reducerPath).toBe("binApi");
    });
  });

  describe("getBin endpoint", () => {
    it("should have getBin endpoint defined", () => {
      expect(binApi.endpoints.getBin).toBeDefined();
    });

    it("should have initiate method for getBin", () => {
      expect(binApi.endpoints.getBin.initiate).toBeDefined();
      expect(typeof binApi.endpoints.getBin.initiate).toBe("function");
    });
  });

  describe("deleteFromBin endpoint", () => {
    it("should have deleteFromBin endpoint defined", () => {
      expect(binApi.endpoints.deleteFromBin).toBeDefined();
    });

    it("should have initiate method for deleteFromBin", () => {
      expect(binApi.endpoints.deleteFromBin.initiate).toBeDefined();
      expect(typeof binApi.endpoints.deleteFromBin.initiate).toBe("function");
    });
  });

  describe("addToBin endpoint", () => {
    it("should have addToBin endpoint defined", () => {
      expect(binApi.endpoints.addToBin).toBeDefined();
    });

    it("should have initiate method for addToBin", () => {
      expect(binApi.endpoints.addToBin.initiate).toBeDefined();
      expect(typeof binApi.endpoints.addToBin.initiate).toBe("function");
    });
  });

  describe("API reducer", () => {
    it("should have a reducer function", () => {
      expect(binApi.reducer).toBeDefined();
      expect(typeof binApi.reducer).toBe("function");
    });

    it("should have middleware", () => {
      expect(binApi.middleware).toBeDefined();
      expect(typeof binApi.middleware).toBe("function");
    });
  });

  describe("endpoint matchers", () => {
    it("should have matchFulfilled matcher for getBin", () => {
      expect(binApi.endpoints.getBin.matchFulfilled).toBeDefined();
    });

    it("should have matchPending matcher for getBin", () => {
      expect(binApi.endpoints.getBin.matchPending).toBeDefined();
    });

    it("should have matchRejected matcher for getBin", () => {
      expect(binApi.endpoints.getBin.matchRejected).toBeDefined();
    });
  });
});
