import { describe, it, expect, vi, beforeEach } from "vitest";
import { Authorization } from "@/lib/features/admin/types";

// Mock jwt-decode before importing the module under test
vi.mock("jwt-decode", () => ({
  jwtDecode: vi.fn(),
}));

import {
  defaultAuthenticationData,
  toUserFromBetterAuthJWT,
  betterAuthSessionToAuthenticationData,
  type BetterAuthSession,
} from "@/lib/features/authentication/utilities";
import { jwtDecode } from "jwt-decode";

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

  describe("toUserFromBetterAuthJWT", () => {
    it("should derive username from email", () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        email: "testuser@wxyc.org",
      });

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.username).toBe("testuser");
      expect(mockedJwtDecode).toHaveBeenCalledWith("fake-token");
    });

    it("should extract email from token", () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        username: "testuser",
        email: "dj@station.org",
      });

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.email).toBe("dj@station.org");
    });

    it("should extract user id from token", () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        id: "user-456",
        email: "test@wxyc.org",
      });

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.id).toBe("user-456");
    });

    it("should fall back to sub for id if id not present", () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        email: "test@wxyc.org",
      });

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.id).toBe("user-123");
    });

    it("should assign SM authority for admin role (admin maps to SM on main)", () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        username: "testuser",
        email: "test@wxyc.org",
        role: "admin",
      });

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.authority).toBe(Authorization.SM);
    });

    it("should assign SM authority for stationManager role", () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        username: "testuser",
        email: "test@wxyc.org",
        role: "stationManager",
      });

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.authority).toBe(Authorization.SM);
    });

    it("should assign MD authority for musicDirector role", () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        username: "testuser",
        email: "test@wxyc.org",
        role: "musicDirector",
      });

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.authority).toBe(Authorization.MD);
    });

    it("should assign DJ authority for dj role", () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        username: "testuser",
        email: "test@wxyc.org",
        role: "dj",
      });

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.authority).toBe(Authorization.DJ);
    });

    it("should assign NO authority for member role", () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        username: "testuser",
        email: "test@wxyc.org",
        role: "member",
      });

      const result = toUserFromBetterAuthJWT("fake-token");

      expect(result.authority).toBe(Authorization.NO);
    });
  });

  describe("betterAuthSessionToAuthenticationData", () => {
    const createMockSession = (userOverrides: Record<string, any> = {}): BetterAuthSession => ({
      user: {
        id: "user-123",
        email: "test@wxyc.org",
        name: "Test User",
        username: "testuser",
        emailVerified: true,
        role: "dj",
        realName: "Test User",
        djName: "DJ Test",
        ...userOverrides,
      },
      session: {
        id: "sess-123",
        userId: "user-123",
        expiresAt: new Date(),
      },
    });

    it("should return 'Not Authenticated' for null session", () => {
      const result = betterAuthSessionToAuthenticationData(null);

      expect(result).toEqual({ message: "Not Authenticated" });
    });

    it("should return 'Not Authenticated' for undefined session", () => {
      const result = betterAuthSessionToAuthenticationData(undefined);

      expect(result).toEqual({ message: "Not Authenticated" });
    });

    it("should return 'Not Authenticated' for session without user", () => {
      const result = betterAuthSessionToAuthenticationData({ user: null } as any);

      expect(result).toEqual({ message: "Not Authenticated" });
    });

    it("should return authenticated user data for valid session with complete profile", () => {
      const session = createMockSession();

      const result = betterAuthSessionToAuthenticationData(session);

      expect(result).toHaveProperty("user");
      expect((result as any).user.username).toBe("testuser");
      expect((result as any).user.email).toBe("test@wxyc.org");
    });

    it("should return IncompleteUser when realName is missing", () => {
      const session = createMockSession({ realName: "" });

      const result = betterAuthSessionToAuthenticationData(session);

      expect(result).toHaveProperty("requiredAttributes");
      expect((result as any).requiredAttributes).toContain("realName");
    });

    it("should return IncompleteUser when djName is missing", () => {
      const session = createMockSession({ djName: "" });

      const result = betterAuthSessionToAuthenticationData(session);

      expect(result).toHaveProperty("requiredAttributes");
      expect((result as any).requiredAttributes).toContain("djName");
    });

    it("should map stationManager role to SM authority", () => {
      const session = createMockSession({ role: "stationManager" });

      const result = betterAuthSessionToAuthenticationData(session);

      expect((result as any).user.authority).toBe(Authorization.SM);
    });

    it("should map musicDirector role to MD authority", () => {
      const session = createMockSession({ role: "musicDirector" });

      const result = betterAuthSessionToAuthenticationData(session);

      expect((result as any).user.authority).toBe(Authorization.MD);
    });

    it("should map dj role to DJ authority", () => {
      const session = createMockSession({ role: "dj" });

      const result = betterAuthSessionToAuthenticationData(session);

      expect((result as any).user.authority).toBe(Authorization.DJ);
    });

    it("should map admin role to SM authority (admin maps to SM on main)", () => {
      const session = createMockSession({ role: "admin" });

      const result = betterAuthSessionToAuthenticationData(session);

      expect((result as any).user.authority).toBe(Authorization.SM);
    });

    it("should extract realName from session", () => {
      const session = createMockSession({ realName: "John Smith" });

      const result = betterAuthSessionToAuthenticationData(session);

      expect((result as any).user.realName).toBe("John Smith");
    });

    it("should extract djName from session", () => {
      const session = createMockSession({ djName: "DJ Cool" });

      const result = betterAuthSessionToAuthenticationData(session);

      expect((result as any).user.djName).toBe("DJ Cool");
    });
  });
});
