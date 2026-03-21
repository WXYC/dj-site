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
vi.mock("@/lib/features/authentication/organization-utils.server", () => ({
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

    it("should redirect to /login when email is not verified", async () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "test",
          emailVerified: false,
          realName: "Test User",
          djName: "DJ Test",
        },
      });
      mockGetSession.mockResolvedValue({ data: session, error: null });

      await expect(requireAuth()).rejects.toThrow("REDIRECT:/login?error=email-not-verified");
      expect(mockRedirect).toHaveBeenCalledWith("/login?error=email-not-verified");
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

    it("should return true when only djName is missing", () => {
      const session = createTestIncompleteSession(["djName"]);

      const result = isUserIncomplete(session);

      expect(result).toBe(true);
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

    it("should return djName when only djName is missing", () => {
      const session = createTestIncompleteSession(["djName"]);

      const result = getIncompleteUserAttributes(session);

      expect(result).toContain("djName");
      expect(result).not.toContain("realName");
    });

    it("should return both realName and djName when both are missing", () => {
      const session = createTestIncompleteSession(["realName", "djName"]);

      const result = getIncompleteUserAttributes(session);

      expect(result).toContain("realName");
      expect(result).toContain("djName");
    });

    it("should detect empty string realName as missing", () => {
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
    });
  });

  describe("getUserFromSession", () => {
    it("should extract basic user information from session", async () => {
      const session = createTestBetterAuthSession({
        user: { id: "user-123", email: "dj@wxyc.org", name: "djuser", username: "djuser", emailVerified: true, realName: "Real DJ Name", djName: "DJ Cool", role: "dj" },
      });
      const result = await getUserFromSession(session);
      expect(result.id).toBe("user-123");
      expect(result.email).toBe("dj@wxyc.org");
      expect(result.realName).toBe("Real DJ Name");
      expect(result.djName).toBe("DJ Cool");
    });

    it("should use username when available", async () => {
      const session = createTestBetterAuthSession({
        user: { id: "test-id", email: "test@wxyc.org", name: "namevalue", username: "usernamevalue", emailVerified: true, realName: "Test User", djName: "DJ Test" },
      });
      const result = await getUserFromSession(session);
      expect(result.username).toBe("usernamevalue");
    });

    it("should fall back to name when username is not set", async () => {
      const session = createTestBetterAuthSession({
        user: { id: "test-id", email: "test@wxyc.org", name: "fallbackname", username: undefined, emailVerified: true, realName: "Test User", djName: "DJ Test" },
      });
      const result = await getUserFromSession(session);
      expect(result.username).toBe("fallbackname");
    });

    it("should map station manager role to SM authority", async () => {
      const session = createTestSessionWithOrgRole("stationManager");
      const result = await getUserFromSession(session);
      expect(result.authority).toBe(Authorization.SM);
    });

    it("should map dj role to DJ authority", async () => {
      const session = createTestSessionWithOrgRole("dj");
      const result = await getUserFromSession(session);
      expect(result.authority).toBe(Authorization.DJ);
    });

    it("should map member role to NO authority", async () => {
      const session = createTestSessionWithOrgRole("member");
      const result = await getUserFromSession(session);
      expect(result.authority).toBe(Authorization.NO);
    });
  });

  describe("checkRole edge cases", () => {
    it("should handle NO authorization requirement", async () => {
      const memberSession = createTestSessionWithOrgRole("member");
      expect(await checkRole(memberSession, Authorization.NO)).toBe(true);
    });
  });

  describe("requireRole additional cases", () => {
    const originalEnv = process.env;
    beforeEach(() => { process.env = { ...originalEnv, NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard" }; });
    afterEach(() => { process.env = originalEnv; });

    it("should allow SM to access SM-required resources", async () => {
      const session = createTestSessionWithOrgRole("stationManager");
      await requireRole(session, Authorization.SM);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should not allow MD to access SM-required resources", async () => {
      const session = createTestSessionWithOrgRole("musicDirector");
      await expect(requireRole(session, Authorization.SM)).rejects.toThrow("REDIRECT:/dashboard");
    });
  });
});
