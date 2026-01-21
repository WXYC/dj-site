import { describe } from "vitest";
import { authenticationApi, djRegistryApi } from "@/lib/features/authentication/api";
import { describeApi } from "@/lib/test-utils";

describe("authenticationApi", () => {
  describeApi(authenticationApi, {
    queries: ["getAuthentication"],
    mutations: [
      "login",
      "modifyUser",
      "newUser",
      "requestPasswordReset",
      "resetPassword",
      "logout",
    ],
    reducerPath: "authenticationApi",
  });
});

describe("djRegistryApi", () => {
  describeApi(djRegistryApi, {
    queries: ["getDJInfo"],
    mutations: ["registerDJ", "modDJInfo", "deleteDJInfo"],
    reducerPath: "djRegistryApi",
  });
});
