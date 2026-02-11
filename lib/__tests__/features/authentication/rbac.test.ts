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

import {
  checkRole,
  requireRole,
} from "@/lib/features/authentication/server-utils";
import {
  createTestBetterAuthSession,
  createTestSessionWithRole,
} from "@/lib/test-utils";

describe("checkRole", () => {
  it("should return true when user has sufficient role", () => {
    const session = createTestSessionWithRole("stationManager");

    expect(checkRole(session, Authorization.DJ)).toBe(true);
  });

  it("should return true when user has exact role", () => {
    const session = createTestSessionWithRole("dj");

    expect(checkRole(session, Authorization.DJ)).toBe(true);
  });

  it("should return false when user has insufficient role", () => {
    const session = createTestSessionWithRole("member");

    expect(checkRole(session, Authorization.DJ)).toBe(false);
  });

  it("should check role hierarchy: SM > MD > DJ > NO", () => {
    const smSession = createTestSessionWithRole("stationManager");
    const mdSession = createTestSessionWithRole("musicDirector");
    const djSession = createTestSessionWithRole("dj");

    expect(checkRole(smSession, Authorization.SM)).toBe(true);
    expect(checkRole(smSession, Authorization.MD)).toBe(true);
    expect(checkRole(smSession, Authorization.DJ)).toBe(true);

    expect(checkRole(mdSession, Authorization.SM)).toBe(false);
    expect(checkRole(mdSession, Authorization.MD)).toBe(true);
    expect(checkRole(mdSession, Authorization.DJ)).toBe(true);

    expect(checkRole(djSession, Authorization.SM)).toBe(false);
    expect(checkRole(djSession, Authorization.MD)).toBe(false);
    expect(checkRole(djSession, Authorization.DJ)).toBe(true);
  });

  it("should handle NO authorization requirement", () => {
    const memberSession = createTestSessionWithRole("member");
    const djSession = createTestSessionWithRole("dj");

    expect(checkRole(memberSession, Authorization.NO)).toBe(true);
    expect(checkRole(djSession, Authorization.NO)).toBe(true);
  });

  it("should handle session with no role property", () => {
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

    expect(checkRole(session, Authorization.NO)).toBe(true);
    expect(checkRole(session, Authorization.DJ)).toBe(false);
  });
});

describe("requireRole", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should not redirect when user has sufficient role", () => {
    const session = createTestSessionWithRole("stationManager");

    requireRole(session, Authorization.DJ);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("should redirect to dashboard home when user has insufficient role", () => {
    const session = createTestSessionWithRole("member");

    expect(() => requireRole(session, Authorization.DJ)).toThrow(
      "REDIRECT:/dashboard"
    );
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("should redirect to default path when NEXT_PUBLIC_DASHBOARD_HOME_PAGE is not set", () => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
    const session = createTestSessionWithRole("member");

    expect(() => requireRole(session, Authorization.DJ)).toThrow(
      "REDIRECT:/dashboard/catalog"
    );
  });

  it("should allow SM to access SM-required resources", () => {
    const session = createTestSessionWithRole("stationManager");

    requireRole(session, Authorization.SM);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("should not allow MD to access SM-required resources", () => {
    const session = createTestSessionWithRole("musicDirector");

    expect(() => requireRole(session, Authorization.SM)).toThrow("REDIRECT:/dashboard");
  });

  it("should allow any role to access NO-required resources", () => {
    const memberSession = createTestSessionWithRole("member");

    requireRole(memberSession, Authorization.NO);

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
