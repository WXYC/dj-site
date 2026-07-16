import { describe } from "vitest";
import { lmlApi } from "@/lib/features/lml/api";
import { describeApi } from "@/tests/helpers";

describe("lmlApi", () => {
  describeApi(lmlApi, {
    queries: ["searchLibrary"],
    mutations: [],
    reducerPath: "lmlApi",
  });
});
