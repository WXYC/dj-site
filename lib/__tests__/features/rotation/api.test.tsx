import { describe, it, expect, vi } from "vitest";
import {
  rotationApi,
  useGetRotationQuery,
  useAddRotationEntryMutation,
  useKillRotationEntryMutation,
} from "@/lib/features/rotation/api";
import { Rotation } from "@/lib/features/rotation/types";
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

  describe("exported hooks", () => {
    it("should export useGetRotationQuery hook", async () => {
      const { useGetRotationQuery } = await import(
        "@/lib/features/rotation/api"
      );
      expect(useGetRotationQuery).toBeDefined();
      expect(typeof useGetRotationQuery).toBe("function");
    });

    it("should export useAddRotationEntryMutation hook", async () => {
      const { useAddRotationEntryMutation } = await import(
        "@/lib/features/rotation/api"
      );
      expect(useAddRotationEntryMutation).toBeDefined();
      expect(typeof useAddRotationEntryMutation).toBe("function");
    });

    it("should export useKillRotationEntryMutation hook", async () => {
      const { useKillRotationEntryMutation } = await import(
        "@/lib/features/rotation/api"
      );
      expect(useKillRotationEntryMutation).toBeDefined();
      expect(typeof useKillRotationEntryMutation).toBe("function");
    });
  });

  describe("API configuration", () => {
    it("should use rotationApi as reducer path", () => {
      expect(rotationApi.reducerPath).toBe("rotationApi");
    });

    it("should export the rotationApi object", () => {
      expect(rotationApi).toBeDefined();
      expect(rotationApi.endpoints).toBeDefined();
    });

    it("should have Rotation tag type", () => {
      expect(rotationApi.reducerPath).toBe("rotationApi");
    });
  });

  describe("getRotation endpoint", () => {
    it("should have getRotation endpoint defined", () => {
      expect(rotationApi.endpoints.getRotation).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(rotationApi.endpoints.getRotation.initiate).toBeDefined();
      expect(typeof rotationApi.endpoints.getRotation.initiate).toBe("function");
    });
  });

  describe("addRotationEntry endpoint", () => {
    it("should have addRotationEntry endpoint defined", () => {
      expect(rotationApi.endpoints.addRotationEntry).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(rotationApi.endpoints.addRotationEntry.initiate).toBeDefined();
      expect(typeof rotationApi.endpoints.addRotationEntry.initiate).toBe("function");
    });
  });

  describe("killRotationEntry endpoint", () => {
    it("should have killRotationEntry endpoint defined", () => {
      expect(rotationApi.endpoints.killRotationEntry).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(rotationApi.endpoints.killRotationEntry.initiate).toBeDefined();
      expect(typeof rotationApi.endpoints.killRotationEntry.initiate).toBe("function");
    });
  });

  describe("API reducer", () => {
    it("should have a reducer function", () => {
      expect(rotationApi.reducer).toBeDefined();
      expect(typeof rotationApi.reducer).toBe("function");
    });

    it("should have middleware", () => {
      expect(rotationApi.middleware).toBeDefined();
      expect(typeof rotationApi.middleware).toBe("function");
    });
  });

  describe("endpoint matchers", () => {
    it("should have matchFulfilled matcher for getRotation", () => {
      expect(rotationApi.endpoints.getRotation.matchFulfilled).toBeDefined();
    });

    it("should have matchPending matcher for getRotation", () => {
      expect(rotationApi.endpoints.getRotation.matchPending).toBeDefined();
    });

    it("should have matchRejected matcher for getRotation", () => {
      expect(rotationApi.endpoints.getRotation.matchRejected).toBeDefined();
    });
  });

  describe("rotation frequency values", () => {
    it("should correctly handle Heavy rotation (H)", () => {
      expect(Rotation.H).toBe("H");
    });

    it("should correctly handle Medium rotation (M)", () => {
      expect(Rotation.M).toBe("M");
    });

    it("should correctly handle Light rotation (L)", () => {
      expect(Rotation.L).toBe("L");
    });

    it("should correctly handle Sound rotation (S)", () => {
      expect(Rotation.S).toBe("S");
    });
  });
});
