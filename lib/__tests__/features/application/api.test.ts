import { describe } from "vitest";
import { applicationApi } from "@/lib/features/application/api";
import { describeApi } from "@/lib/test-utils";

describe("applicationApi", () => {
  describeApi(applicationApi, {
    queries: ["getRightbar"],
    mutations: ["toggleRightbar"],
    reducerPath: "applicationApi",
  });
});
