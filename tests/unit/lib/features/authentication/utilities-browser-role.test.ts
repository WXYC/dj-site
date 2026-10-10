import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Authorization } from "@/lib/features/admin/types";

const mockGetJWTToken = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {},
  authFetch: vi.fn(),
  getJWTToken: () => mockGetJWTToken(),
}));

// A production build leaves the browser without an organization id: the read
// is not build-inlined, so the helper returns undefined there.
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationId: () => undefined,
  getAppOrganizationIdClient: () => undefined,
}));

import { betterAuthSessionToAuthenticationDataAsync } from "@/lib/features/authentication/utilities";
import { isAuthResultUncacheable } from "@/lib/features/authentication/auth-result-cacheability";
import { createTestBetterAuthSession } from "@/tests/fixtures/fixtures";

const USER_ID = "test-user-id-123";

const mintJwt = (claims: Record<string, unknown>) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ id: USER_ID, exp: Math.floor(Date.now() / 1000) + 600, ...claims })}.sig`;
};

describe("betterAuthSessionToAuthenticationDataAsync in the browser without an organization id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // auth_user.role is better-auth's admin flag: null for everyone but station managers.
  it.each([
    ["dj", null, Authorization.DJ],
    ["musicDirector", null, Authorization.MD],
    ["stationManager", "admin", Authorization.SM],
    ["member", null, Authorization.NO],
    ["dj", "admin", Authorization.DJ],
  ])("resolves the JWT role claim %s (auth_user.role %s) to its authority", async (claim, userRole, expected) => {
    mockGetJWTToken.mockResolvedValue(mintJwt({ role: claim }));
    const session = createTestBetterAuthSession({
      user: { ...createTestBetterAuthSession().user, role: userRole },
    });

    const result = await betterAuthSessionToAuthenticationDataAsync(session);

    expect((result as any).user.authority).toBe(expected);
  });

  // Each case pairs a token that must not yield a station role with
  // auth_user.role = "admin", so a fallback to session data would show up as SM.
  // Only the first case is a token that could not be fetched at all.
  it.each([
    ["no token could be fetched", null, true],
    ["an expired token", mintJwt({ role: "stationManager", exp: Math.floor(Date.now() / 1000) - 60 }), false],
    ["a token whose subject is another user", mintJwt({ id: "someone-else", role: "stationManager" }), false],
    ["an unparseable token", "not-a-jwt", false],
    ["an unrecognized role claim", mintJwt({ role: "wizard" }), false],
  ])(
    "fails closed to no authority with %s, whatever auth_user.role says",
    async (_name, token, tokenUnavailable) => {
      mockGetJWTToken.mockResolvedValue(token);
      const session = createTestBetterAuthSession({
        user: { ...createTestBetterAuthSession().user, role: "admin" },
      });

      const result = await betterAuthSessionToAuthenticationDataAsync(session);

      expect((result as any).user.authority).toBe(Authorization.NO);
      // Only a missing token is provisional; a fetched token that names no role is an answer.
      expect(isAuthResultUncacheable(result)).toBe(tokenUnavailable);
    },
  );

  it("marks a fetch that throws as provisional too", async () => {
    mockGetJWTToken.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await betterAuthSessionToAuthenticationDataAsync(createTestBetterAuthSession());

    expect((result as any).user.authority).toBe(Authorization.NO);
    expect(isAuthResultUncacheable(result)).toBe(true);
  });

  it("does not mark a resolved role as provisional", async () => {
    mockGetJWTToken.mockResolvedValue(mintJwt({ role: "dj" }));

    const result = await betterAuthSessionToAuthenticationDataAsync(createTestBetterAuthSession());

    expect(isAuthResultUncacheable(result)).toBe(false);
  });
});
