import { describe } from "vitest";
import { adminApi } from "@/lib/features/admin/api";
import { describeApi } from "@/lib/test-utils";

describe("adminApi", () => {
  describeApi(adminApi, {
    queries: ["listAccounts"],
    mutations: ["createAccount", "deleteAccount", "promoteAccount", "resetPassword"],
    reducerPath: "adminApi",
  });
});
