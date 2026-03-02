import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  getAppOrganizationId: vi.fn().mockReturnValue(undefined),
  getUserRoleInOrganization: vi.fn().mockResolvedValue(undefined),
}));

import {
  checkRole,
  requireRole,
} from "@/lib/features/authentication/server-utils";
import {
  createTestBetterAuthSession,
  createTestSessionWithRole,
} from "@/lib/test-utils";

describe("checkRole", () => {
  beforeEach(() => {
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
  });

  it("should return true when user has sufficient role", async () => {
    const session = createTestSessionWithRole("stationManager");

    expect(await checkRole(session, Authorization.DJ)).toBe(true);
  });

  it("should return true when user has exact role", async () => {
    const session = createTestSessionWithRole("dj");

    expect(await checkRole(session, Authorization.DJ)).toBe(true);
  });

  it("should return false when user has insufficient role", async () => {
    const session = createTestSessionWithRole("member");

    expect(await checkRole(session, Authorization.DJ)).toBe(false);
  });

  it("should check role hierarchy: SM > MD > DJ > NO", async () => {
    const smSession = createTestSessionWithRole("stationManager");
    const mdSession = createTestSessionWithRole("musicDirector");
    const djSession = createTestSessionWithRole("dj");

    expect(await checkRole(smSession, Authorization.SM)).toBe(true);
    expect(await checkRole(smSession, Authorization.MD)).toBe(true);
    expect(await checkRole(smSession, Authorization.DJ)).toBe(true);

    expect(await checkRole(mdSession, Authorization.SM)).toBe(false);
    expect(await checkRole(mdSession, Authorization.MD)).toBe(true);
    expect(await checkRole(mdSession, Authorization.DJ)).toBe(true);

    expect(await checkRole(djSession, Authorization.SM)).toBe(false);
    expect(await checkRole(djSession, Authorization.MD)).toBe(false);
    expect(await checkRole(djSession, Authorization.DJ)).toBe(true);
  });

  it("should handle NO authorization requirement", async () => {
    const memberSession = createTestSessionWithRole("member");
    const djSession = createTestSessionWithRole("dj");

    expect(await checkRole(memberSession, Authorization.NO)).toBe(true);
    expect(await checkRole(djSession, Authorization.NO)).toBe(true);
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

    expect(await checkRole(session, Authorization.NO)).toBe(true);
    expect(await checkRole(session, Authorization.DJ)).toBe(false);
  });
});

describe("requireRole", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
    process.env = { ...originalEnv, NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should not redirect when user has sufficient role", async () => {
    const session = createTestSessionWithRole("stationManager");

    await requireRole(session, Authorization.DJ);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("should redirect to dashboard home when user has insufficient role", async () => {
    const session = createTestSessionWithRole("member");

    await expect(requireRole(session, Authorization.DJ)).rejects.toThrow(
      "REDIRECT:/dashboard"
    );
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("should redirect to default path when NEXT_PUBLIC_DASHBOARD_HOME_PAGE is not set", async () => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
    const session = createTestSessionWithRole("member");

    await expect(requireRole(session, Authorization.DJ)).rejects.toThrow(
      "REDIRECT:/dashboard/catalog"
    );
  });

  it("should allow SM to access SM-required resources", async () => {
    const session = createTestSessionWithRole("stationManager");

    await requireRole(session, Authorization.SM);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("should not allow MD to access SM-required resources", async () => {
    const session = createTestSessionWithRole("musicDirector");

    await expect(requireRole(session, Authorization.SM)).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("should allow any role to access NO-required resources", async () => {
    const memberSession = createTestSessionWithRole("member");

    await requireRole(memberSession, Authorization.NO);

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
