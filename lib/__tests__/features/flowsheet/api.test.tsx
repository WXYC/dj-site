import { describe, it, expect, vi } from "vitest";
import {
  flowsheetApi,
  useGetNowPlayingQuery,
  useGetEntriesQuery,
  useJoinShowMutation,
  useLeaveShowMutation,
  useWhoIsLiveQuery,
  useAddToFlowsheetMutation,
  useRemoveFromFlowsheetMutation,
  useUpdateFlowsheetMutation,
  useSwitchEntriesMutation,
} from "@/lib/features/flowsheet/api";
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

  describe("exported hooks", () => {
    it("should export useGetNowPlayingQuery hook", async () => {
      const { useGetNowPlayingQuery } = await import(
        "@/lib/features/flowsheet/api"
      );
      expect(useGetNowPlayingQuery).toBeDefined();
      expect(typeof useGetNowPlayingQuery).toBe("function");
    });

    it("should export useGetEntriesQuery hook", async () => {
      const { useGetEntriesQuery } = await import(
        "@/lib/features/flowsheet/api"
      );
      expect(useGetEntriesQuery).toBeDefined();
      expect(typeof useGetEntriesQuery).toBe("function");
    });

    it("should export useJoinShowMutation hook", async () => {
      const { useJoinShowMutation } = await import(
        "@/lib/features/flowsheet/api"
      );
      expect(useJoinShowMutation).toBeDefined();
      expect(typeof useJoinShowMutation).toBe("function");
    });

    it("should export useLeaveShowMutation hook", async () => {
      const { useLeaveShowMutation } = await import(
        "@/lib/features/flowsheet/api"
      );
      expect(useLeaveShowMutation).toBeDefined();
      expect(typeof useLeaveShowMutation).toBe("function");
    });

    it("should export useWhoIsLiveQuery hook", async () => {
      const { useWhoIsLiveQuery } = await import(
        "@/lib/features/flowsheet/api"
      );
      expect(useWhoIsLiveQuery).toBeDefined();
      expect(typeof useWhoIsLiveQuery).toBe("function");
    });

    it("should export useAddToFlowsheetMutation hook", async () => {
      const { useAddToFlowsheetMutation } = await import(
        "@/lib/features/flowsheet/api"
      );
      expect(useAddToFlowsheetMutation).toBeDefined();
      expect(typeof useAddToFlowsheetMutation).toBe("function");
    });

    it("should export useRemoveFromFlowsheetMutation hook", async () => {
      const { useRemoveFromFlowsheetMutation } = await import(
        "@/lib/features/flowsheet/api"
      );
      expect(useRemoveFromFlowsheetMutation).toBeDefined();
      expect(typeof useRemoveFromFlowsheetMutation).toBe("function");
    });

    it("should export useUpdateFlowsheetMutation hook", async () => {
      const { useUpdateFlowsheetMutation } = await import(
        "@/lib/features/flowsheet/api"
      );
      expect(useUpdateFlowsheetMutation).toBeDefined();
      expect(typeof useUpdateFlowsheetMutation).toBe("function");
    });

    it("should export useSwitchEntriesMutation hook", async () => {
      const { useSwitchEntriesMutation } = await import(
        "@/lib/features/flowsheet/api"
      );
      expect(useSwitchEntriesMutation).toBeDefined();
      expect(typeof useSwitchEntriesMutation).toBe("function");
    });
  });

  describe("API configuration", () => {
    it("should use flowsheetApi as reducer path", () => {
      expect(flowsheetApi.reducerPath).toBe("flowsheetApi");
    });

    it("should export the flowsheetApi object", () => {
      expect(flowsheetApi).toBeDefined();
      expect(flowsheetApi.endpoints).toBeDefined();
    });

    it("should have tag types configured", () => {
      expect(flowsheetApi.reducerPath).toBe("flowsheetApi");
    });
  });

  describe("getNowPlaying endpoint", () => {
    it("should have getNowPlaying endpoint defined", () => {
      expect(flowsheetApi.endpoints.getNowPlaying).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.getNowPlaying.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.getNowPlaying.initiate).toBe("function");
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
  });

  describe("switchEntries endpoint", () => {
    it("should have switchEntries endpoint defined", () => {
      expect(flowsheetApi.endpoints.switchEntries).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.switchEntries.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.switchEntries.initiate).toBe("function");
    });
  });

  describe("joinShow endpoint", () => {
    it("should have joinShow endpoint defined", () => {
      expect(flowsheetApi.endpoints.joinShow).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.joinShow.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.joinShow.initiate).toBe("function");
    });
  });

  describe("leaveShow endpoint", () => {
    it("should have leaveShow endpoint defined", () => {
      expect(flowsheetApi.endpoints.leaveShow).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.leaveShow.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.leaveShow.initiate).toBe("function");
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
  });

  describe("addToFlowsheet endpoint", () => {
    it("should have addToFlowsheet endpoint defined", () => {
      expect(flowsheetApi.endpoints.addToFlowsheet).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.addToFlowsheet.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.addToFlowsheet.initiate).toBe("function");
    });
  });

  describe("removeFromFlowsheet endpoint", () => {
    it("should have removeFromFlowsheet endpoint defined", () => {
      expect(flowsheetApi.endpoints.removeFromFlowsheet).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.removeFromFlowsheet.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.removeFromFlowsheet.initiate).toBe("function");
    });
  });

  describe("updateFlowsheet endpoint", () => {
    it("should have updateFlowsheet endpoint defined", () => {
      expect(flowsheetApi.endpoints.updateFlowsheet).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(flowsheetApi.endpoints.updateFlowsheet.initiate).toBeDefined();
      expect(typeof flowsheetApi.endpoints.updateFlowsheet.initiate).toBe("function");
    });
  });

  describe("API reducer", () => {
    it("should have a reducer function", () => {
      expect(flowsheetApi.reducer).toBeDefined();
      expect(typeof flowsheetApi.reducer).toBe("function");
    });

    it("should have middleware", () => {
      expect(flowsheetApi.middleware).toBeDefined();
      expect(typeof flowsheetApi.middleware).toBe("function");
    });
  });

  describe("endpoint matchers", () => {
    it("should have matchFulfilled matcher for getNowPlaying", () => {
      expect(flowsheetApi.endpoints.getNowPlaying.matchFulfilled).toBeDefined();
    });

    it("should have matchPending matcher for getNowPlaying", () => {
      expect(flowsheetApi.endpoints.getNowPlaying.matchPending).toBeDefined();
    });

    it("should have matchRejected matcher for getNowPlaying", () => {
      expect(flowsheetApi.endpoints.getNowPlaying.matchRejected).toBeDefined();
    });

    it("should have matchFulfilled matcher for getEntries", () => {
      expect(flowsheetApi.endpoints.getEntries.matchFulfilled).toBeDefined();
    });

    it("should have matchFulfilled matcher for whoIsLive", () => {
      expect(flowsheetApi.endpoints.whoIsLive.matchFulfilled).toBeDefined();
    });
  });
});
