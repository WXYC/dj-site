import { describe } from "vitest";
import { applicationApi } from "@/lib/features/application/api";
import { describeApi } from "@/tests/helpers";

describe("applicationApi", () => {
  describeApi(applicationApi, {
    queries: ["getRightbar"],
    mutations: ["toggleRightbar"],
    reducerPath: "applicationApi",
  });
});
