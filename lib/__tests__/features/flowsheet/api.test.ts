import { describe } from "vitest";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { describeApi } from "@/lib/test-utils";

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
});
