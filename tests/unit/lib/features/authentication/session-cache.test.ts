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
  getUserRoleInOrganization: (userId: string, orgId: string | undefined, cookie?: string) =>
    mockGetUserRoleInOrganization(userId, orgId, cookie),
}));

import {
  getSessionCached,
  getOrgRoleCached,
  transportRetryConfig,
} from "@/lib/features/authentication/session-cache";
import { classifySessionRead } from "@/lib/features/authentication/utilities";

describe("session-cache", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetUserRoleInOrganization.mockReset();
    // Avoid waiting out the real transport-retry delay in tests that reject.
    transportRetryConfig.delayMs = 0;
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

    it("tags a rejected auth fetch with an explicit transport discriminant, honestly modeling the error", async () => {
      const error = new Error("auth server unreachable");
      mockGetSession.mockRejectedValue(error);

      const result = await getSessionCached("cookie");

      expect(result).toEqual({
        data: null,
        error: { message: "auth server unreachable", transport: true },
      });
    });

    it("classifies a rejected fetch as unavailable, not absent — a regression guard distinct from a clean data: null", async () => {
      mockGetSession.mockRejectedValue(new Error("auth server unreachable"));

      const result = await getSessionCached("cookie-transport");

      expect(classifySessionRead(result).kind).toBe("unavailable");
    });

    it("distinguishes a resolved 429 from a clean absent session — the regression guard for the whole issue", async () => {
      mockGetSession.mockResolvedValue({
        data: null,
        error: {
          message: "Too many requests. Please try again later.",
          status: 429,
          statusText: "Too Many Requests",
        },
      });
      const rateLimited = await getSessionCached("cookie-429");
      expect(classifySessionRead(rateLimited).kind).toBe("unavailable");

      mockGetSession.mockResolvedValue({ data: null });
      const absent = await getSessionCached("cookie-clean");
      expect(classifySessionRead(absent).kind).toBe("absent");
    });

    it("retries the transport fetch exactly once on rejection, and not at all on a resolved 429", async () => {
      mockGetSession.mockRejectedValue(new Error("boom"));
      await getSessionCached("cookie-retry-a");
      expect(mockGetSession).toHaveBeenCalledTimes(2);

      mockGetSession.mockReset();
      mockGetSession.mockResolvedValue({
        data: null,
        error: { message: "Too many requests. Please try again later.", status: 429 },
      });
      await getSessionCached("cookie-retry-b");
      expect(mockGetSession).toHaveBeenCalledTimes(1);
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

    it("forwards an undefined organizationId — the deployed shape, since APP_ORGANIZATION is unset", async () => {
      mockGetUserRoleInOrganization.mockResolvedValue("musicDirector");

      const role = await getOrgRoleCached("u1", undefined, "cookie");

      expect(mockGetUserRoleInOrganization).toHaveBeenCalledWith(
        "u1",
        undefined,
        "cookie"
      );
      expect(role).toBe("musicDirector");
    });
  });
});
