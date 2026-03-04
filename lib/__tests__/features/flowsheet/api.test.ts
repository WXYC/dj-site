import { describe, it, expect, vi } from "vitest";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { describeApi } from "@/lib/test-utils";

// Mock the authentication client
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("flowsheetApi", () => {
  describeApi(flowsheetApi, {
    queries: ["getNowPlaying", "getEntries", "whoIsLive"],
    mutations: [
      "addToFlowsheet",
      "removeFromFlowsheet",
      "updateFlowsheet",
      "joinShow",
      "leaveShow",
      "switchEntries",
    ],
    reducerPath: "flowsheetApi",
  });

  describe("getNowPlaying endpoint", () => {
    it("should have getNowPlaying endpoint defined", () => {
      expect(flowsheetApi.endpoints.getNowPlaying).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.getNowPlaying.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.getNowPlaying.initiate).toBe("function");
    });

    it("should have match methods for state changes", () => {
      expect(flowsheetApi.endpoints.getNowPlaying.matchFulfilled).toBeDefined();
      expect(flowsheetApi.endpoints.getNowPlaying.matchPending).toBeDefined();
      expect(flowsheetApi.endpoints.getNowPlaying.matchRejected).toBeDefined();
    });
  });

  describe("getEntries endpoint", () => {
    it("should have getEntries endpoint defined", () => {
      expect(flowsheetApi.endpoints.getEntries).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.getEntries.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.getEntries.initiate).toBe("function");
    });

    it("should have match methods for state changes", () => {
      expect(flowsheetApi.endpoints.getEntries.matchFulfilled).toBeDefined();
      expect(flowsheetApi.endpoints.getEntries.matchPending).toBeDefined();
      expect(flowsheetApi.endpoints.getEntries.matchRejected).toBeDefined();
    });
  });

  describe("whoIsLive endpoint", () => {
    it("should have whoIsLive endpoint defined", () => {
      expect(flowsheetApi.endpoints.whoIsLive).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.whoIsLive.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.whoIsLive.initiate).toBe("function");
    });

    it("should have match methods for state changes", () => {
      expect(flowsheetApi.endpoints.whoIsLive.matchFulfilled).toBeDefined();
    });
  });

  describe("mutation endpoints", () => {
    it("should have joinShow endpoint defined", () => {
      expect(flowsheetApi.endpoints.joinShow).toBeDefined();
      expect(flowsheetApi.endpoints.joinShow.initiate).toBeDefined();
    });

    it("should have leaveShow endpoint defined", () => {
      expect(flowsheetApi.endpoints.leaveShow).toBeDefined();
      expect(flowsheetApi.endpoints.leaveShow.initiate).toBeDefined();
    });

    it("should have addToFlowsheet endpoint defined", () => {
      expect(flowsheetApi.endpoints.addToFlowsheet).toBeDefined();
      expect(flowsheetApi.endpoints.addToFlowsheet.initiate).toBeDefined();
    });

    it("should have removeFromFlowsheet endpoint defined", () => {
      expect(flowsheetApi.endpoints.removeFromFlowsheet).toBeDefined();
      expect(flowsheetApi.endpoints.removeFromFlowsheet.initiate).toBeDefined();
    });

    it("should have updateFlowsheet endpoint defined", () => {
      expect(flowsheetApi.endpoints.updateFlowsheet).toBeDefined();
      expect(flowsheetApi.endpoints.updateFlowsheet.initiate).toBeDefined();
    });

    it("should have switchEntries endpoint defined", () => {
      expect(flowsheetApi.endpoints.switchEntries).toBeDefined();
      expect(flowsheetApi.endpoints.switchEntries.initiate).toBeDefined();
    });
  });

  describe("API configuration", () => {
    it("should use flowsheetApi as reducer path", () => {
      expect(flowsheetApi.reducerPath).toBe("flowsheetApi");
    });

    it("should have reducer function", () => {
      expect(flowsheetApi.reducer).toBeDefined();
      expect(typeof flowsheetApi.reducer).toBe("function");
    });

    it("should have middleware function", () => {
      expect(flowsheetApi.middleware).toBeDefined();
      expect(typeof flowsheetApi.middleware).toBe("function");
    });
  });
});
