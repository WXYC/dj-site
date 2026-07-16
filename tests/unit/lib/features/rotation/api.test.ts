import { describe } from "vitest";
import { rotationApi } from "@/lib/features/rotation/api";
import { describeApi } from "@/tests/helpers";

describe("rotationApi", () => {
  describeApi(rotationApi, {
    queries: ["getRotation"],
    mutations: ["addRotationEntry", "killRotationEntry"],
    reducerPath: "rotationApi",
  });
});
