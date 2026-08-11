import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
import { Authorization } from "@/lib/features/admin/types";

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: vi.fn(),
  },
}));

const mockGetUserRoleInOrganization = vi.fn();
vi.mock("@/lib/features/authentication/organization-utils.server", () => ({
  getAppOrganizationId: vi.fn().mockReturnValue(undefined),
  getUserRoleInOrganization: (userId: string, orgId: string | undefined, cookie?: string) =>
    mockGetUserRoleInOrganization(userId, orgId, cookie),
}));

import {
  checkRole,
  requireRole,
} from "@/lib/features/authentication/server-utils";
import { createTestBetterAuthSession } from "@/tests/helpers";
import type { BetterAuthSession } from "@/lib/features/authentication/utilities";
import type { WXYCRole } from "@/lib/features/authentication/types";

/**
 * A realistic session (role null — better-auth's admin-plugin column, never
 * a WXYC tier) paired with a mocked JWT-first role resolution, standing in
 * for what a decoded JWT claim carries in production.
 */
function sessionWithResolvedRole(role: WXYCRole): BetterAuthSession {
  mockGetUserRoleInOrganization.mockResolvedValue(role);
  return createTestBetterAuthSession({
    user: {
      id: "test-id",
      email: "test@wxyc.org",
      name: "testuser",
      emailVerified: true,
      realName: "Test User",
      djName: "DJ Test",
      role: null,
    },
  });
}

describe("checkRole", () => {
  beforeEach(() => {
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
    mockGetUserRoleInOrganization.mockReset();
  });

  it("should return true when user has sufficient role", async () => {
    const session = sessionWithResolvedRole("stationManager");

    expect(await checkRole(session, Authorization.DJ, "session=test-cookie")).toBe(true);
  });

  it("should return true when user has exact role", async () => {
    const session = sessionWithResolvedRole("dj");

    expect(await checkRole(session, Authorization.DJ, "session=test-cookie")).toBe(true);
  });

  it("should return false when user has insufficient role", async () => {
    const session = sessionWithResolvedRole("member");

    expect(await checkRole(session, Authorization.DJ, "session=test-cookie")).toBe(false);
  });

  it("should check role hierarchy: SM > MD > DJ > NO", async () => {
    const smSession = sessionWithResolvedRole("stationManager");
    expect(await checkRole(smSession, Authorization.SM, "session=test-cookie")).toBe(true);
    expect(await checkRole(smSession, Authorization.MD, "session=test-cookie")).toBe(true);
    expect(await checkRole(smSession, Authorization.DJ, "session=test-cookie")).toBe(true);

    const mdSession = sessionWithResolvedRole("musicDirector");
    expect(await checkRole(mdSession, Authorization.SM, "session=test-cookie")).toBe(false);
    expect(await checkRole(mdSession, Authorization.MD, "session=test-cookie")).toBe(true);
    expect(await checkRole(mdSession, Authorization.DJ, "session=test-cookie")).toBe(true);

    const djSession = sessionWithResolvedRole("dj");
    expect(await checkRole(djSession, Authorization.SM, "session=test-cookie")).toBe(false);
    expect(await checkRole(djSession, Authorization.MD, "session=test-cookie")).toBe(false);
    expect(await checkRole(djSession, Authorization.DJ, "session=test-cookie")).toBe(true);
  });

  it("should handle NO authorization requirement", async () => {
    const memberSession = sessionWithResolvedRole("member");
    expect(await checkRole(memberSession, Authorization.NO, "session=test-cookie")).toBe(true);

    const djSession = sessionWithResolvedRole("dj");
    expect(await checkRole(djSession, Authorization.NO, "session=test-cookie")).toBe(true);
  });

  it("should handle session with no role property", async () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "testuser",
        emailVerified: true,
        realName: "Test User",
        djName: "DJ Test",
      },
    });
    delete (session.user as any).role;

    expect(await checkRole(session, Authorization.NO, "session=test-cookie")).toBe(true);
    expect(await checkRole(session, Authorization.DJ, "session=test-cookie")).toBe(false);
  });
});

describe("requireRole", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // vi.clearAllMocks() clears call history but not a configured
    // mockResolvedValue — sessionWithResolvedRole sets one as a side effect,
    // so it must be reset explicitly or a test that forgets to call it would
    // silently inherit the previous test's resolved role.
    mockGetUserRoleInOrganization.mockReset();
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
    process.env = { ...originalEnv, NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should not redirect when user has sufficient role", async () => {
    const session = sessionWithResolvedRole("stationManager");

    await requireRole(session, Authorization.DJ);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("should redirect to dashboard home when user has insufficient role", async () => {
    const session = sessionWithResolvedRole("member");

    await expect(requireRole(session, Authorization.DJ)).rejects.toThrow(
      "REDIRECT:/dashboard"
    );
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("should redirect to default path when NEXT_PUBLIC_DASHBOARD_HOME_PAGE is not set", async () => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
    const session = sessionWithResolvedRole("member");

    await expect(requireRole(session, Authorization.DJ)).rejects.toThrow(
      "REDIRECT:/dashboard/catalog"
    );
  });

  it("should allow SM to access SM-required resources", async () => {
    const session = sessionWithResolvedRole("stationManager");

    await requireRole(session, Authorization.SM);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("should not allow MD to access SM-required resources", async () => {
    const session = sessionWithResolvedRole("musicDirector");

    await expect(requireRole(session, Authorization.SM)).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("should allow MD to reach an MD-required resource without redirecting, with APP_ORGANIZATION unset", async () => {
    const session = sessionWithResolvedRole("musicDirector");

    await requireRole(session, Authorization.MD);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("should allow any role to access NO-required resources", async () => {
    const memberSession = sessionWithResolvedRole("member");

    await requireRole(memberSession, Authorization.NO);

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
