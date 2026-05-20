import { describe } from "vitest";
import { lmlApi } from "@/lib/features/lml/api";
import { describeApi } from "@/lib/test-utils";

describe("lmlApi", () => {
  describeApi(lmlApi, {
    queries: ["searchLibrary"],
    mutations: [],
    reducerPath: "lmlApi",
  });
});
