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

  it("fails closed to no authority when the JWT carries no usable role, whatever auth_user.role says", async () => {
    mockGetJWTToken.mockResolvedValue(null);
    const session = createTestBetterAuthSession({
      user: { ...createTestBetterAuthSession().user, role: "admin" },
    });

    const result = await betterAuthSessionToAuthenticationDataAsync(session);

    expect((result as any).user.authority).toBe(Authorization.NO);
  });
});
