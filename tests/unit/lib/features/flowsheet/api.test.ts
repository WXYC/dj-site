import { describe } from "vitest";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { describeApi } from "@/tests/helpers";

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
});
