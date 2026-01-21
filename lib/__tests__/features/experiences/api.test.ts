import { describe } from "vitest";
import { experienceApi } from "@/lib/features/experiences/api";
import { describeApi } from "@/lib/test-utils";

describe("experienceApi", () => {
  describeApi(experienceApi, {
    queries: ["getActiveExperience"],
    mutations: ["switchExperience"],
    reducerPath: "experienceApi",
  });
});
