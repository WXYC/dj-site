import { describe, it, expect } from "vitest";
import {
  convertBetterAuthToAccountResult,
  mapBetterAuthRoleToAuthorization,
  BetterAuthUser,
} from "@/lib/features/admin/conversions-better-auth";
import {
  AdminAuthenticationStatus,
  Authorization,
} from "@/lib/features/admin/types";

// Test fixture for BetterAuthUser
function createTestBetterAuthUser(
  overrides: Partial<BetterAuthUser> = {}
): BetterAuthUser {
  return {
    id: "test-user-id",
    email: "test@wxyc.org",
    name: "testuser",
    username: "testuser",
    emailVerified: true,
    realName: "Test User",
    djName: "DJ Test",
    role: "dj",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("admin conversions (Better Auth)", () => {
  describe("convertBetterAuthToAccountResult", () => {
    it("should extract username from user", () => {
      const user = createTestBetterAuthUser({ username: "cooluser" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.userName).toBe("cooluser");
    });

    it("should fall back to name when username is not set", () => {
      const user = createTestBetterAuthUser({ username: undefined, name: "fallbackname" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.userName).toBe("fallbackname");
    });

    it("should extract real name from user", () => {
      const user = createTestBetterAuthUser({ realName: "John Smith" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.realName).toBe("John Smith");
    });

    it("should fall back to name when realName is not set", () => {
      const user = createTestBetterAuthUser({ realName: undefined, name: "Test Name" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.realName).toBe("Test Name");
    });

    it("should use 'No Real Name' when neither realName nor name is set", () => {
      const user = createTestBetterAuthUser({ realName: undefined, name: "" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.realName).toBe("No Real Name");
    });

    it("should extract DJ name from user", () => {
      const user = createTestBetterAuthUser({ djName: "DJ Awesome" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.djName).toBe("DJ Awesome");
    });

    it("should use 'No DJ Name' when djName is not set", () => {
      const user = createTestBetterAuthUser({ djName: undefined });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.djName).toBe("No DJ Name");
    });

    it("should extract email from user", () => {
      const user = createTestBetterAuthUser({ email: "john@wxyc.org" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.email).toBe("john@wxyc.org");
    });

    it("should assign SM authorization for stationManager role", () => {
      const user = createTestBetterAuthUser({ role: "stationManager" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.authorization).toBe(Authorization.SM);
    });

    it("should assign MD authorization for musicDirector role", () => {
      const user = createTestBetterAuthUser({ role: "musicDirector" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.authorization).toBe(Authorization.MD);
    });

    it("should assign DJ authorization for dj role", () => {
      const user = createTestBetterAuthUser({ role: "dj" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.authorization).toBe(Authorization.DJ);
    });

    it("should assign NO authorization for member role", () => {
      const user = createTestBetterAuthUser({ role: "member" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.authorization).toBe(Authorization.NO);
    });

    it("should set Confirmed status when emailVerified is true", () => {
      const user = createTestBetterAuthUser({ emailVerified: true });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.authType).toBe(AdminAuthenticationStatus.Confirmed);
    });

    it("should set New status when emailVerified is false", () => {
      const user = createTestBetterAuthUser({ emailVerified: false });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.authType).toBe(AdminAuthenticationStatus.New);
    });

    it("should include user ID in result", () => {
      const user = createTestBetterAuthUser({ id: "user-456" });
      const result = convertBetterAuthToAccountResult(user);
      expect(result.id).toBe("user-456");
    });
  });

  describe("mapBetterAuthRoleToAuthorization", () => {
    it("should map stationManager to SM", () => {
      const result = mapBetterAuthRoleToAuthorization("stationManager");
      expect(result).toBe(Authorization.SM);
    });

    it("should map musicDirector to MD", () => {
      const result = mapBetterAuthRoleToAuthorization("musicDirector");
      expect(result).toBe(Authorization.MD);
    });

    it("should map dj to DJ", () => {
      const result = mapBetterAuthRoleToAuthorization("dj");
      expect(result).toBe(Authorization.DJ);
    });

    it("should map member to NO", () => {
      const result = mapBetterAuthRoleToAuthorization("member");
      expect(result).toBe(Authorization.NO);
    });
  });
});
