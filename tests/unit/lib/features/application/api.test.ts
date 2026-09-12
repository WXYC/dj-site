import { describe } from "vitest";
import { applicationApi } from "@/lib/features/application/api";
import { describeApi } from "@/tests/helpers/api-harness";

describe("applicationApi", () => {
  describeApi(applicationApi, {
    queries: ["getRightbar"],
    mutations: ["toggleRightbar"],
    reducerPath: "applicationApi",
  });
});
