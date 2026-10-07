import { describe } from "vitest";
import { reviewsApi } from "@/lib/features/reviews/api";
import { describeApi } from "@/tests/helpers/api-harness";

describe("reviewsApi", () => {
  describeApi(reviewsApi, {
    queries: ["getIntakeItems"],
    mutations: [],
    reducerPath: "reviewsApi",
  });
});
