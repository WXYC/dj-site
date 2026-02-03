import { describe, it, expect } from "vitest";
import { Authorization } from "@/lib/features/admin/types";
import { mapRoleToAuthorization } from "@/lib/features/authentication/types";
import {
  convertBetterAuthToAccountResult,
  BetterAuthUser,
} from "@/lib/features/admin/conversions-better-auth";

/**
 * This function replicates the logic in AccountEntry.tsx (lines 29-35).
 * It converts WXYC roles to Better Auth's user/admin binary.
 */
function toAdminRole(
  role: "member" | "dj" | "musicDirector" | "stationManager"
): "user" | "admin" {
  return role === "stationManager" ? "admin" : "user";
}

/**
 * Simulates the full round-trip:
 * 1. Admin promotes user to a role via UI
 * 2. toAdminRole converts it for Better Auth storage
 * 3. Better Auth stores and returns the converted role
 * 4. convertBetterAuthToAccountResult maps it back to Authorization
 */
function simulateRoleRoundTrip(
  intendedRole: "member" | "dj" | "musicDirector" | "stationManager"
): Authorization {
  // Step 1: Admin selects role in UI (e.g., "musicDirector")
  // Step 2: toAdminRole converts it for Better Auth
  const storedRole = toAdminRole(intendedRole);

  // Step 3: Better Auth stores and returns this role
  // Step 4: We read it back and convert to Authorization
  const mockUser: BetterAuthUser = {
    id: "test-user-123",
    email: "test@wxyc.org",
    name: "testuser",
    emailVerified: true,
    role: storedRole as BetterAuthUser["role"], // Type assertion to simulate what Better Auth returns
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const account = convertBetterAuthToAccountResult(mockUser);
  return account.authorization;
}

describe("Role Round-Trip Bug", () => {
  describe("toAdminRole collapses role hierarchy", () => {
    it("converts stationManager to 'admin'", () => {
      expect(toAdminRole("stationManager")).toBe("admin");
    });

    it("converts musicDirector to 'user' (LOSES DISTINCTION)", () => {
      expect(toAdminRole("musicDirector")).toBe("user");
    });

    it("converts dj to 'user' (LOSES DISTINCTION)", () => {
      expect(toAdminRole("dj")).toBe("user");
    });

    it("converts member to 'user'", () => {
      expect(toAdminRole("member")).toBe("user");
    });

    it("musicDirector and dj become indistinguishable", () => {
      expect(toAdminRole("musicDirector")).toBe(toAdminRole("dj"));
    });
  });

  describe("mapRoleToAuthorization handles Better Auth roles", () => {
    it("maps 'admin' to SM", () => {
      expect(mapRoleToAuthorization("admin")).toBe(Authorization.SM);
    });

    it("maps 'user' to NO (not DJ or MD!)", () => {
      expect(mapRoleToAuthorization("user")).toBe(Authorization.NO);
    });
  });

  describe("Full round-trip demonstrates data loss", () => {
    it("stationManager survives round-trip", () => {
      const result = simulateRoleRoundTrip("stationManager");
      expect(result).toBe(Authorization.SM);
    });

    it("musicDirector FAILS round-trip - becomes NO instead of MD", () => {
      const result = simulateRoleRoundTrip("musicDirector");
      // This SHOULD be Authorization.MD, but due to the bug it becomes NO
      expect(result).toBe(Authorization.MD); // FAILS - actual is Authorization.NO
    });

    it("dj FAILS round-trip - becomes NO instead of DJ", () => {
      const result = simulateRoleRoundTrip("dj");
      // This SHOULD be Authorization.DJ, but due to the bug it becomes NO
      expect(result).toBe(Authorization.DJ); // FAILS - actual is Authorization.NO
    });

    it("member round-trip (expected to be NO)", () => {
      const result = simulateRoleRoundTrip("member");
      expect(result).toBe(Authorization.NO);
    });
  });

  describe("What SHOULD happen (without toAdminRole)", () => {
    it("musicDirector stored directly maps to MD", () => {
      // If we stored "musicDirector" directly instead of converting to "user"
      expect(mapRoleToAuthorization("musicDirector")).toBe(Authorization.MD);
    });

    it("dj stored directly maps to DJ", () => {
      // If we stored "dj" directly instead of converting to "user"
      expect(mapRoleToAuthorization("dj")).toBe(Authorization.DJ);
    });

    it("stationManager stored directly maps to SM", () => {
      expect(mapRoleToAuthorization("stationManager")).toBe(Authorization.SM);
    });
  });
});
