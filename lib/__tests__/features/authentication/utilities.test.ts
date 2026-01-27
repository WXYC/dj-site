import { describe, it, expect, vi, beforeEach } from "vitest";
import { Authorization } from "@/lib/features/admin/types";
import type { BetterAuthJwtPayload } from "@/lib/features/authentication/types";

// Mock jwt-decode before importing the module under test
vi.mock("jwt-decode", () => ({
  jwtDecode: vi.fn(),
}));

// Mock organization-utils
vi.mock("@/lib/features/authentication/organization-utils", () => ({
  getAppOrganizationId: vi.fn(() => undefined),
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

import {
  defaultAuthenticationData,
  betterAuthSessionToAuthenticationData,
  toUserFromBetterAuthJWT,
  BetterAuthSession,
} from "@/lib/features/authentication/utilities";
import { jwtDecode } from "jwt-decode";
import {
  createTestBetterAuthSession,
  createTestIncompleteSession,
  createTestSessionWithOrgRole,
  createTestBetterAuthJWTPayload,
} from "@/lib/test-utils";

const mockedJwtDecode = vi.mocked(jwtDecode);

describe("authentication utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("defaultAuthenticationData", () => {
    it("should have 'Not Authenticated' message", () => {
      expect(defaultAuthenticationData.message).toBe("Not Authenticated");
    });
  });

  describe("betterAuthSessionToAuthenticationData", () => {
    it("should return 'Not Authenticated' for null session", () => {
      const result = betterAuthSessionToAuthenticationData(null);
      expect(result).toEqual({ message: "Not Authenticated" });
    });

    it("should return 'Not Authenticated' for undefined session", () => {
      const result = betterAuthSessionToAuthenticationData(undefined);
      expect(result).toEqual({ message: "Not Authenticated" });
    });

    it("should return 'Not Authenticated' for session without user", () => {
      const result = betterAuthSessionToAuthenticationData({
        session: { id: "test", userId: "test", expiresAt: new Date() },
      } as any);
      expect(result).toEqual({ message: "Not Authenticated" });
    });

    it("should extract username from session.user.username", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "Test Name",
          username: "testusername",
          emailVerified: true,
          realName: "Test User",
          djName: "DJ Test",
        },
      });
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.username).toBe("testusername");
    });

    it("should fall back to session.user.name when username is not set", () => {
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
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.username).toBe("fallbackname");
    });

    it("should identify incomplete users missing realName", () => {
      const session = createTestIncompleteSession(["realName"]);
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).requiredAttributes).toContain("realName");
    });

    it("should identify incomplete users missing djName", () => {
      const session = createTestIncompleteSession(["djName"]);
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).requiredAttributes).toContain("djName");
    });

    it("should identify incomplete users missing both realName and djName", () => {
      const session = createTestIncompleteSession(["realName", "djName"]);
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).requiredAttributes).toContain("realName");
      expect((result as any).requiredAttributes).toContain("djName");
    });

    it("should treat empty string realName as incomplete", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: "   ",
          djName: "DJ Test",
        },
      });
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).requiredAttributes).toContain("realName");
    });

    it("should map organization.role to Authorization", () => {
      const session = createTestSessionWithOrgRole("stationManager");
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.authority).toBe(Authorization.SM);
    });

    it("should map musicDirector role to MD Authorization", () => {
      const session = createTestSessionWithOrgRole("musicDirector");
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.authority).toBe(Authorization.MD);
    });

    it("should map dj role to DJ Authorization", () => {
      const session = createTestSessionWithOrgRole("dj");
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.authority).toBe(Authorization.DJ);
    });

    it("should map member role to NO Authorization", () => {
      const session = createTestSessionWithOrgRole("member");
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.authority).toBe(Authorization.NO);
    });

    describe("role fallback chain", () => {
      it("should prefer organization.role over user.role", () => {
        const session = createTestBetterAuthSession({
          user: {
            id: "test-id",
            email: "test@wxyc.org",
            name: "testuser",
            emailVerified: true,
            realName: "Test User",
            djName: "DJ Test",
            role: "member", // Base role
            organization: {
              id: "org-123",
              name: "WXYC",
              role: "stationManager", // Org role should take precedence
            },
          },
        });
        const result = betterAuthSessionToAuthenticationData(session);
        expect((result as any).user?.authority).toBe(Authorization.SM);
      });

      it("should use metadata.role when organization.role is not present", () => {
        const session = createTestBetterAuthSession({
          user: {
            id: "test-id",
            email: "test@wxyc.org",
            name: "testuser",
            emailVerified: true,
            realName: "Test User",
            djName: "DJ Test",
            role: "member", // Base role
            metadata: {
              role: "musicDirector",
            },
          } as any,
        });
        const result = betterAuthSessionToAuthenticationData(session);
        expect((result as any).user?.authority).toBe(Authorization.MD);
      });

      it("should fall back to user.role when no org or metadata role", () => {
        const session = createTestBetterAuthSession({
          user: {
            id: "test-id",
            email: "test@wxyc.org",
            name: "testuser",
            emailVerified: true,
            realName: "Test User",
            djName: "DJ Test",
            role: "dj",
          },
        });
        const result = betterAuthSessionToAuthenticationData(session);
        expect((result as any).user?.authority).toBe(Authorization.DJ);
      });
    });

    it("should include session token in result", () => {
      const session = createTestBetterAuthSession({
        session: {
          id: "session-id",
          userId: "user-id",
          expiresAt: new Date(),
          token: "my-session-token",
        },
      });
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).token).toBe("my-session-token");
      expect((result as any).accessToken).toBe("my-session-token");
    });

    it("should extract all user fields correctly", () => {
      const createdAt = new Date("2024-01-01");
      const updatedAt = new Date("2024-06-01");
      const session = createTestBetterAuthSession({
        user: {
          id: "user-123",
          email: "test@wxyc.org",
          name: "testuser",
          username: "testuser",
          emailVerified: true,
          realName: "Test Real Name",
          djName: "DJ Test Name",
          appSkin: "dark",
          createdAt,
          updatedAt,
          role: "dj",
        },
      });
      const result = betterAuthSessionToAuthenticationData(session);
      const user = (result as any).user;

      expect(user.id).toBe("user-123");
      expect(user.email).toBe("test@wxyc.org");
      expect(user.username).toBe("testuser");
      expect(user.realName).toBe("Test Real Name");
      expect(user.djName).toBe("DJ Test Name");
      expect(user.emailVerified).toBe(true);
      expect(user.appSkin).toBe("dark");
      expect(user.createdAt).toEqual(createdAt);
      expect(user.updatedAt).toEqual(updatedAt);
    });
  });

  describe("toUserFromBetterAuthJWT", () => {
    it("should extract user ID from token", () => {
      const payload = createTestBetterAuthJWTPayload({ id: "user-456" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.id).toBe("user-456");
      expect(mockedJwtDecode).toHaveBeenCalledWith("fake-token");
    });

    it("should fall back to sub when id is not present", () => {
      const payload = createTestBetterAuthJWTPayload({
        id: undefined,
        sub: "sub-user-789",
      });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.id).toBe("sub-user-789");
    });

    it("should extract email from token", () => {
      const payload = createTestBetterAuthJWTPayload({ email: "dj@station.org" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.email).toBe("dj@station.org");
    });

    it("should derive username from email", () => {
      const payload = createTestBetterAuthJWTPayload({ email: "cooluser@wxyc.org" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.username).toBe("cooluser");
    });

    it("should map stationManager role to SM authority", () => {
      const payload = createTestBetterAuthJWTPayload({ role: "stationManager" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.authority).toBe(Authorization.SM);
    });

    it("should map musicDirector role to MD authority", () => {
      const payload = createTestBetterAuthJWTPayload({ role: "musicDirector" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.authority).toBe(Authorization.MD);
    });

    it("should map dj role to DJ authority", () => {
      const payload = createTestBetterAuthJWTPayload({ role: "dj" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.authority).toBe(Authorization.DJ);
    });

    it("should map member role to NO authority", () => {
      const payload = createTestBetterAuthJWTPayload({ role: "member" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.authority).toBe(Authorization.NO);
    });
  });
});
