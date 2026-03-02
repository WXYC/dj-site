import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Authorization } from "@/lib/features/admin/types";

// Mock next/headers
const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

// Mock server auth client
const mockGetSession = vi.fn();
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: (options: any) => mockGetSession(options),
  },
}));

// Mock organization utils
const mockGetUserRoleInOrganization = vi.fn();
const mockGetAppOrganizationId = vi.fn();
vi.mock("@/lib/features/authentication/organization-utils", () => ({
  getUserRoleInOrganization: (userId: string, orgId: string, cookie?: string) =>
    mockGetUserRoleInOrganization(userId, orgId, cookie),
  getAppOrganizationId: () => mockGetAppOrganizationId(),
}));

import {
  getServerSession,
  requireAuth,
  checkRole,
  requireRole,
  isUserIncomplete,
  getIncompleteUserAttributes,
  getUserFromSession,
} from "@/lib/features/authentication/server-utils";
import {
  createTestBetterAuthSession,
  createTestIncompleteSession,
  createTestSessionWithOrgRole,
} from "@/lib/test-utils";

describe("server-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
    mockGetAppOrganizationId.mockReturnValue(undefined);
  });

  describe("getServerSession", () => {
    it("should return session when authenticated", async () => {
      const session = createTestBetterAuthSession();
      mockGetSession.mockResolvedValue({ data: session, error: null });

      const result = await getServerSession();

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe(session.user.id);
    });

    it("should return null when not authenticated", async () => {
      mockGetSession.mockResolvedValue({ data: null, error: null });

      const result = await getServerSession();

      expect(result).toBeNull();
    });

    it("should return null on auth error", async () => {
      mockGetSession.mockRejectedValue(new Error("Auth server error"));

      const result = await getServerSession();

      expect(result).toBeNull();
    });

    it("should pass cookies to auth client", async () => {
      const session = createTestBetterAuthSession();
      mockGetSession.mockResolvedValue({ data: session, error: null });

      await getServerSession();

      expect(mockGetSession).toHaveBeenCalledWith({
        fetchOptions: {
          headers: { cookie: "session=test-cookie" },
        },
      });
    });

    it("should normalize username from null to undefined", async () => {
      const session = {
        ...createTestBetterAuthSession(),
        user: {
          ...createTestBetterAuthSession().user,
          username: null,
        },
      };
      mockGetSession.mockResolvedValue({ data: session, error: null });

      const result = await getServerSession();

      expect(result?.user.username).toBeUndefined();
    });
  });

  describe("requireAuth", () => {
    it("should return session when authenticated", async () => {
      const session = createTestBetterAuthSession();
      mockGetSession.mockResolvedValue({ data: session, error: null });

      const result = await requireAuth();

      expect(result.user.id).toBe(session.user.id);
    });

    it("should redirect to /login when not authenticated", async () => {
      mockGetSession.mockResolvedValue({ data: null, error: null });

      await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("checkRole", () => {
    beforeEach(() => {
      mockGetAppOrganizationId.mockReturnValue(undefined);
    });

    it("should return true when user has sufficient role", async () => {
      const session = createTestSessionWithOrgRole("stationManager");

      const result = await checkRole(session, Authorization.DJ);

      expect(result).toBe(true);
    });

    it("should return true when user has exact role", async () => {
      const session = createTestSessionWithOrgRole("dj");

      const result = await checkRole(session, Authorization.DJ);

      expect(result).toBe(true);
    });

    it("should return false when user has insufficient role", async () => {
      const session = createTestSessionWithOrgRole("member");

      const result = await checkRole(session, Authorization.DJ);

      expect(result).toBe(false);
    });

    it("should check role hierarchy: SM > MD > DJ > NO", async () => {
      const smSession = createTestSessionWithOrgRole("stationManager");
      const mdSession = createTestSessionWithOrgRole("musicDirector");
      const djSession = createTestSessionWithOrgRole("dj");

      // SM can access everything
      expect(await checkRole(smSession, Authorization.SM)).toBe(true);
      expect(await checkRole(smSession, Authorization.MD)).toBe(true);
      expect(await checkRole(smSession, Authorization.DJ)).toBe(true);

      // MD can access MD and below
      expect(await checkRole(mdSession, Authorization.SM)).toBe(false);
      expect(await checkRole(mdSession, Authorization.MD)).toBe(true);
      expect(await checkRole(mdSession, Authorization.DJ)).toBe(true);

      // DJ can only access DJ and below
      expect(await checkRole(djSession, Authorization.SM)).toBe(false);
      expect(await checkRole(djSession, Authorization.MD)).toBe(false);
      expect(await checkRole(djSession, Authorization.DJ)).toBe(true);
    });

    it("should fetch role from organization when APP_ORGANIZATION is set", async () => {
      mockGetAppOrganizationId.mockReturnValue("wxyc-org-id");
      mockGetUserRoleInOrganization.mockResolvedValue("stationManager");

      const session = createTestBetterAuthSession();
      const result = await checkRole(session, Authorization.SM, "cookie-header");

      expect(mockGetUserRoleInOrganization).toHaveBeenCalledWith(
        session.user.id,
        "wxyc-org-id",
        "cookie-header"
      );
      expect(result).toBe(true);
    });

    it("should fall back to session role when organization lookup fails", async () => {
      mockGetAppOrganizationId.mockReturnValue("wxyc-org-id");
      mockGetUserRoleInOrganization.mockRejectedValue(new Error("Org lookup failed"));

      const session = createTestSessionWithOrgRole("dj");
      const result = await checkRole(session, Authorization.DJ);

      expect(result).toBe(true);
    });
  });

  describe("requireRole", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard" };
      mockGetAppOrganizationId.mockReturnValue(undefined);
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should not redirect when user has sufficient role", async () => {
      const session = createTestSessionWithOrgRole("stationManager");

      await requireRole(session, Authorization.DJ);

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should redirect to dashboard home when user has insufficient role", async () => {
      const session = createTestSessionWithOrgRole("member");

      await expect(requireRole(session, Authorization.DJ)).rejects.toThrow(
        "REDIRECT:/dashboard"
      );
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("should redirect to default path when NEXT_PUBLIC_DASHBOARD_HOME_PAGE is not set", async () => {
      process.env = { ...originalEnv };
      delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
      const session = createTestSessionWithOrgRole("member");

      await expect(requireRole(session, Authorization.DJ)).rejects.toThrow(
        "REDIRECT:/dashboard/catalog"
      );
    });
  });

  describe("isUserIncomplete", () => {
    it("should return false for complete user", () => {
      const session = createTestBetterAuthSession();

      const result = isUserIncomplete(session);

      expect(result).toBe(false);
    });

    it("should return true when realName is missing", () => {
      const session = createTestIncompleteSession(["realName"]);

      const result = isUserIncomplete(session);

      expect(result).toBe(true);
    });

    it("should return false when djName is missing", () => {
      const session = createTestIncompleteSession(["djName"]);

      const result = isUserIncomplete(session);

      expect(result).toBe(false);
    });

    it("should return true when realName is empty string", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "test",
          emailVerified: true,
          realName: "",
          djName: "DJ Test",
        },
      });

      const result = isUserIncomplete(session);

      expect(result).toBe(true);
    });

    it("should return true when realName is whitespace only", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "test",
          emailVerified: true,
          realName: "   ",
          djName: "DJ Test",
        },
      });

      const result = isUserIncomplete(session);

      expect(result).toBe(true);
    });
  });

  describe("getIncompleteUserAttributes", () => {
    it("should return empty array for complete user", () => {
      const session = createTestBetterAuthSession();

      const result = getIncompleteUserAttributes(session);

      expect(result).toEqual([]);
    });

    it("should return realName when missing", () => {
      const session = createTestIncompleteSession(["realName"]);

      const result = getIncompleteUserAttributes(session);

      expect(result).toContain("realName");
      expect(result).not.toContain("djName");
    });

    it("should not return djName when missing (djName is optional)", () => {
      const session = createTestIncompleteSession(["djName"]);

      const result = getIncompleteUserAttributes(session);

      expect(result).not.toContain("djName");
      expect(result).not.toContain("realName");
    });

    it("should return only realName when both are missing", () => {
      const session = createTestIncompleteSession(["realName", "djName"]);

      const result = getIncompleteUserAttributes(session);

      expect(result).toContain("realName");
      expect(result).not.toContain("djName");
    });

    it("should detect empty string realName as missing but not djName", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "test",
          emailVerified: true,
          realName: "",
          djName: "",
        },
      });

      const result = getIncompleteUserAttributes(session);

      expect(result).toContain("realName");
      expect(result).not.toContain("djName");
    });

    it("should detect whitespace-only realName as missing but not djName", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "test",
          emailVerified: true,
          realName: "   ",
          djName: "  \t  ",
        },
      });

      const result = getIncompleteUserAttributes(session);

      expect(result).toContain("realName");
      expect(result).not.toContain("djName");
    });
  });

  describe("getUserFromSession", () => {
    it("should extract basic user information from session", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "user-123",
          email: "dj@wxyc.org",
          name: "djuser",
          username: "djuser",
          emailVerified: true,
          realName: "Real DJ Name",
          djName: "DJ Cool",
          role: "dj",
        },
      });

      const result = getUserFromSession(session);

      expect(result.id).toBe("user-123");
      expect(result.email).toBe("dj@wxyc.org");
      expect(result.name).toBe("djuser");
      expect(result.realName).toBe("Real DJ Name");
      expect(result.djName).toBe("DJ Cool");
    });

    it("should use username when available", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "namevalue",
          username: "usernamevalue",
          emailVerified: true,
          realName: "Test User",
          djName: "DJ Test",
        },
      });

      const result = getUserFromSession(session);

      expect(result.username).toBe("usernamevalue");
    });

    it("should fall back to name when username is not set", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "fallbackname",
          username: undefined,
          emailVerified: true,
          realName: "Test User",
          djName: "DJ Test",
        },
      });

      const result = getUserFromSession(session);

      expect(result.username).toBe("fallbackname");
    });

    it("should map station manager role to SM authority", () => {
      const session = createTestSessionWithRole("stationManager");

      const result = getUserFromSession(session);

      expect(result.authority).toBe(Authorization.SM);
    });

    it("should map music director role to MD authority", () => {
      const session = createTestSessionWithRole("musicDirector");

      const result = getUserFromSession(session);

      expect(result.authority).toBe(Authorization.MD);
    });

    it("should map dj role to DJ authority", () => {
      const session = createTestSessionWithRole("dj");

      const result = getUserFromSession(session);

      expect(result.authority).toBe(Authorization.DJ);
    });

    it("should map member role to NO authority", () => {
      const session = createTestSessionWithRole("member");

      const result = getUserFromSession(session);

      expect(result.authority).toBe(Authorization.NO);
    });

    it("should handle missing role by defaulting to NO authority", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: "Test User",
          djName: "DJ Test",
          role: undefined,
        },
      });

      const result = getUserFromSession(session);

      expect(result.authority).toBe(Authorization.NO);
    });

    it("should convert undefined realName to undefined (not null)", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: undefined,
          djName: "DJ Test",
        },
      });

      const result = getUserFromSession(session);

      expect(result.realName).toBeUndefined();
    });

    it("should convert undefined djName to undefined (not null)", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: "Test User",
          djName: undefined,
        },
      });

      const result = getUserFromSession(session);

      expect(result.djName).toBeUndefined();
    });

    it("should include emailVerified status", () => {
      const sessionVerified = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: "Test User",
          djName: "DJ Test",
        },
      });

      const sessionUnverified = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: false,
          realName: "Test User",
          djName: "DJ Test",
        },
      });

      expect(getUserFromSession(sessionVerified).emailVerified).toBe(true);
      expect(getUserFromSession(sessionUnverified).emailVerified).toBe(false);
    });

    it("should include appSkin preference", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: "Test User",
          djName: "DJ Test",
          appSkin: "dark",
        },
      });

      const result = getUserFromSession(session);

      expect(result.appSkin).toBe("dark");
    });

    it("should include createdAt and updatedAt timestamps", () => {
      const createdAt = new Date("2024-01-15");
      const updatedAt = new Date("2024-06-20");
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: "Test User",
          djName: "DJ Test",
          createdAt,
          updatedAt,
        },
      });

      const result = getUserFromSession(session);

      expect(result.createdAt).toEqual(createdAt);
      expect(result.updatedAt).toEqual(updatedAt);
    });
  });

  describe("checkRole edge cases", () => {
    it("should handle NO authorization requirement", () => {
      const memberSession = createTestSessionWithRole("member");
      const djSession = createTestSessionWithRole("dj");

      // Even member can access NO-required resources
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
      // Remove role explicitly
      delete (session.user as any).role;

      // Should default to NO authorization
      expect(checkRole(session, Authorization.NO)).toBe(true);
      expect(checkRole(session, Authorization.DJ)).toBe(false);
    });
  });

  describe("isUserIncomplete edge cases", () => {
    it("should return false when djName is whitespace only (djName is optional)", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "test",
          emailVerified: true,
          realName: "Valid Name",
          djName: "   ",
        },
      });

      const result = isUserIncomplete(session);

      expect(result).toBe(false);
    });

    it("should return false when both names have valid values", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "test",
          emailVerified: true,
          realName: "Valid Real Name",
          djName: "Valid DJ Name",
        },
      });

      const result = isUserIncomplete(session);

      expect(result).toBe(false);
    });

    it("should return true when both names are missing", () => {
      const session = createTestIncompleteSession(["realName", "djName"]);

      const result = isUserIncomplete(session);

      expect(result).toBe(true);
    });
  });

  describe("getServerSession additional cases", () => {
    it("should preserve all user fields when normalizing session", async () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "user-456",
          email: "complete@wxyc.org",
          name: "completename",
          username: "completeuser",
          emailVerified: true,
          realName: "Complete Real Name",
          djName: "Complete DJ Name",
          appSkin: "light",
          role: "musicDirector",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
        },
      });
      mockGetSession.mockResolvedValue({ data: session, error: null });

      const result = await getServerSession();

      expect(result?.user.id).toBe("user-456");
      expect(result?.user.email).toBe("complete@wxyc.org");
      expect(result?.user.name).toBe("completename");
      expect(result?.user.username).toBe("completeuser");
      expect(result?.user.emailVerified).toBe(true);
      expect(result?.user.realName).toBe("Complete Real Name");
      expect(result?.user.djName).toBe("Complete DJ Name");
      expect(result?.user.appSkin).toBe("light");
    });

    it("should handle session with error in response", async () => {
      mockGetSession.mockResolvedValue({
        data: null,
        error: { message: "Session expired", code: "SESSION_EXPIRED" },
      });

      const result = await getServerSession();

      expect(result).toBeNull();
    });
  });

  describe("requireRole additional cases", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard" };
    });

    afterEach(() => {
      process.env = originalEnv;
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
});
