import { describe, it, expect, vi, beforeEach } from "vitest";
import { Authorization } from "@/lib/features/admin/types";

import {
  defaultAuthenticationData,
  betterAuthSessionToAuthenticationData,
  classifySessionRead,
  BetterAuthSession,
  BetterAuthSessionResponse,
} from "@/lib/features/authentication/utilities";
import {
  createTestBetterAuthSession,
  createTestIncompleteSession,
  createTestSessionWithRole,
} from "@/tests/helpers";

describe("authentication utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("defaultAuthenticationData", () => {
    it("should have 'Not Authenticated' message", () => {
      expect((defaultAuthenticationData as { message: string }).message).toBe("Not Authenticated");
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

    it("should not include djName in required attributes (it is optional)", () => {
      const session = createTestIncompleteSession(["djName"]);
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).requiredAttributes).not.toContain("djName");
    });

    it("should only include realName when both realName and djName are missing", () => {
      const session = createTestIncompleteSession(["realName", "djName"]);
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).requiredAttributes).toContain("realName");
      expect((result as any).requiredAttributes).not.toContain("djName");
    });

    it("should treat empty string realName as incomplete when hasCompletedOnboarding is false", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: "   ",
          djName: "DJ Test",
          hasCompletedOnboarding: false,
        },
      });
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).requiredAttributes).toContain("realName");
    });

    it("should return IncompleteUser when hasCompletedOnboarding is false even with all fields present", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: "Valid Name",
          djName: "DJ Test",
          hasCompletedOnboarding: false,
        },
      });
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).requiredAttributes).toBeDefined();
      expect((result as any).requiredAttributes).toEqual([]);
    });

    it("should return AuthenticatedUser when hasCompletedOnboarding is true even if djName is empty", () => {
      const session = createTestBetterAuthSession({
        user: {
          id: "test-id",
          email: "test@wxyc.org",
          name: "testuser",
          emailVerified: true,
          realName: "Valid Name",
          djName: "",
          hasCompletedOnboarding: true,
        },
      });
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user).toBeDefined();
      expect((result as any).user.realName).toBe("Valid Name");
    });

    it("should map stationManager role to SM Authorization", () => {
      const session = createTestSessionWithRole("stationManager");
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.authority).toBe(Authorization.SM);
    });

    it("should map musicDirector role to MD Authorization", () => {
      const session = createTestSessionWithRole("musicDirector");
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.authority).toBe(Authorization.MD);
    });

    it("should map dj role to DJ Authorization", () => {
      const session = createTestSessionWithRole("dj");
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.authority).toBe(Authorization.DJ);
    });

    it("should map member role to NO Authorization", () => {
      const session = createTestSessionWithRole("member");
      const result = betterAuthSessionToAuthenticationData(session);
      expect((result as any).user?.authority).toBe(Authorization.NO);
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

  describe("classifySessionRead", () => {
    it("classifies a valid session", () => {
      const session = createTestBetterAuthSession();
      const response: BetterAuthSessionResponse = { data: session };

      expect(classifySessionRead(response)).toEqual({
        kind: "session",
        session,
      });
    });

    it.each([
      [
        "429",
        { data: null, error: { message: "Too many requests. Please try again later.", status: 429, statusText: "Too Many Requests" } },
        { kind: "unavailable", status: 429 },
      ],
      [
        "5xx",
        { data: null, error: { message: "Internal Server Error", status: 503, statusText: "Service Unavailable" } },
        { kind: "unavailable", status: 503 },
      ],
      [
        "a transport-tagged error",
        { data: null, error: { message: "auth server unreachable", transport: true } },
        { kind: "unavailable" },
      ],
      [
        "401",
        { data: null, error: { message: "Unauthorized", status: 401, statusText: "Unauthorized" } },
        { kind: "absent" },
      ],
      [
        "403",
        { data: null, error: { message: "Forbidden", status: 403, statusText: "Forbidden" } },
        { kind: "absent" },
      ],
      [
        "a status-less error carrying a code — the SESSION_EXPIRED shape",
        { data: null, error: { message: "Session expired", code: "SESSION_EXPIRED" } },
        { kind: "absent" },
      ],
      [
        "a clean data: null with no error",
        { data: null },
        { kind: "absent" },
      ],
    ] as [string, BetterAuthSessionResponse, ReturnType<typeof classifySessionRead>][])(
      "classifies %s as %j",
      (_description, response, expected) => {
        expect(classifySessionRead(response)).toEqual(expected);
      }
    );

    it("never infers a transport failure from an absent status alone — that would misclassify the SESSION_EXPIRED shape as unavailable", () => {
      const response: BetterAuthSessionResponse = {
        data: null,
        error: { message: "Session expired", code: "SESSION_EXPIRED" },
      };

      expect(classifySessionRead(response).kind).toBe("absent");
    });
  });
});
