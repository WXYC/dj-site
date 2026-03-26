import { describe, it, expect } from "vitest";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { describeApi } from "@/lib/test-utils";
import { makeStore } from "@/lib/store";
import type { RootState } from "@/lib/store";

describe("flowsheetApi", () => {
  describeApi(flowsheetApi, {
    queries: ["getNowPlaying", "getInfiniteEntries", "whoIsLive"],
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

  it("should use immediate invalidation behavior", () => {
    const store = makeStore();
    const state = store.getState() as RootState & Record<string, unknown>;
    const apiState = state[flowsheetApi.reducerPath] as {
      config: { invalidationBehavior: string };
    };

    expect(apiState.config.invalidationBehavior).toBe("immediately");
  });
});
