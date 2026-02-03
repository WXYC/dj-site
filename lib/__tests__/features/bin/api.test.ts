import { describe } from "vitest";
import { binApi } from "@/lib/features/bin/api";
import { describeApi } from "@/lib/test-utils";

describe("binApi", () => {
  describeApi(binApi, {
    queries: ["getBin"],
    mutations: ["deleteFromBin", "addToBin"],
    reducerPath: "binApi",
  });
});
