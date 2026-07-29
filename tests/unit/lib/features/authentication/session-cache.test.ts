import { describe, it, expect, vi, beforeEach } from "vitest";

// Identity-mock react cache() so behavior is deterministic (matches
// session.test.ts). The ×N→×1 dedup that real cache() provides is a
// request-scoped runtime property, not unit-observable here; it is verified via
// the [server_timing] logs on a real render. These tests cover the seam's
// behavior: correct pass-through of args + results, and the getSession catch.
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...actual, cache: (fn: (...args: unknown[]) => unknown) => fn };
});

const mockGetSession = vi.fn();
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: (options: unknown) => mockGetSession(options),
  },
}));

const mockGetUserRoleInOrganization = vi.fn();
vi.mock("@/lib/features/authentication/organization-utils.server", () => ({
  getUserRoleInOrganization: (userId: string, orgId: string, cookie?: string) =>
    mockGetUserRoleInOrganization(userId, orgId, cookie),
}));

import {
  getSessionCached,
  getOrgRoleCached,
} from "@/lib/features/authentication/session-cache";

describe("session-cache", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetUserRoleInOrganization.mockReset();
  });

  describe("getSessionCached", () => {
    it("forwards the cookie header to the auth client and returns its result", async () => {
      const response = { data: { user: { id: "u1" } } };
      mockGetSession.mockResolvedValue(response);

      const result = await getSessionCached("better-auth.session=abc");

      expect(mockGetSession).toHaveBeenCalledWith({
        fetchOptions: { headers: { cookie: "better-auth.session=abc" } },
      });
      expect(result).toBe(response);
    });

    it("fails open to a null-data response when the auth fetch rejects", async () => {
      const error = new Error("auth server unreachable");
      mockGetSession.mockRejectedValue(error);

      const result = await getSessionCached("cookie");

      expect(result).toEqual({ data: null, error });
    });
  });

  describe("getOrgRoleCached", () => {
    it("forwards user, org, and cookie and returns the role", async () => {
      mockGetUserRoleInOrganization.mockResolvedValue("dj");

      const role = await getOrgRoleCached("u1", "org1", "cookie");

      expect(mockGetUserRoleInOrganization).toHaveBeenCalledWith(
        "u1",
        "org1",
        "cookie"
      );
      expect(role).toBe("dj");
    });
  });
});
