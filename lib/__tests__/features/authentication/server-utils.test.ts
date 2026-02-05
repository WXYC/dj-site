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

import {
  getServerSession,
  requireAuth,
  checkRole,
  requireRole,
  isUserIncomplete,
  getIncompleteUserAttributes,
} from "@/lib/features/authentication/server-utils";
import {
  createTestBetterAuthSession,
  createTestIncompleteSession,
  createTestSessionWithRole,
} from "@/lib/test-utils";

describe("server-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
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
    it("should return true when user has sufficient role", () => {
      const session = createTestSessionWithRole("stationManager");

      const result = checkRole(session, Authorization.DJ);

      expect(result).toBe(true);
    });

    it("should return true when user has exact role", () => {
      const session = createTestSessionWithRole("dj");

      const result = checkRole(session, Authorization.DJ);

      expect(result).toBe(true);
    });

    it("should return false when user has insufficient role", () => {
      const session = createTestSessionWithRole("member");

      const result = checkRole(session, Authorization.DJ);

      expect(result).toBe(false);
    });

    it("should check role hierarchy: SM > MD > DJ > NO", () => {
      const smSession = createTestSessionWithRole("stationManager");
      const mdSession = createTestSessionWithRole("musicDirector");
      const djSession = createTestSessionWithRole("dj");

      // SM can access everything
      expect(checkRole(smSession, Authorization.SM)).toBe(true);
      expect(checkRole(smSession, Authorization.MD)).toBe(true);
      expect(checkRole(smSession, Authorization.DJ)).toBe(true);

      // MD can access MD and below
      expect(checkRole(mdSession, Authorization.SM)).toBe(false);
      expect(checkRole(mdSession, Authorization.MD)).toBe(true);
      expect(checkRole(mdSession, Authorization.DJ)).toBe(true);

      // DJ can only access DJ and below
      expect(checkRole(djSession, Authorization.SM)).toBe(false);
      expect(checkRole(djSession, Authorization.MD)).toBe(false);
      expect(checkRole(djSession, Authorization.DJ)).toBe(true);
    });
  });

  describe("requireRole", () => {
    const originalEnv = process.env;

    beforeEach(() => {
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

    it("should return true when djName is missing", () => {
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

    it("should return djName when missing", () => {
      const session = createTestIncompleteSession(["djName"]);

      const result = getIncompleteUserAttributes(session);

      expect(result).toContain("djName");
      expect(result).not.toContain("realName");
    });

    it("should return both when both are missing", () => {
      const session = createTestIncompleteSession(["realName", "djName"]);

      const result = getIncompleteUserAttributes(session);

      expect(result).toContain("realName");
      expect(result).toContain("djName");
    });

    it("should detect empty string as missing", () => {
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
      expect(result).toContain("djName");
    });
  });
});
