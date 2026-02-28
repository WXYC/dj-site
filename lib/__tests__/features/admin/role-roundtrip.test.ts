import { describe, it, expect } from "vitest";
import { Authorization } from "@/lib/features/admin/types";
import { mapRoleToAuthorization } from "@/lib/features/authentication/types";
import {
  convertBetterAuthToAccountResult,
  BetterAuthUser,
} from "@/lib/features/admin/conversions-better-auth";

/**
 * Simulates the full round-trip when roles are stored directly:
 * 1. Admin promotes user to a role via UI
 * 2. Role is passed directly to Better Auth (no conversion)
 * 3. Better Auth stores and returns the role
 * 4. convertBetterAuthToAccountResult maps it back to Authorization
 */
function simulateRoleRoundTrip(
  role: "member" | "dj" | "musicDirector" | "stationManager"
): Authorization {
  const mockUser: BetterAuthUser = {
    id: "test-user-123",
    email: "test@wxyc.org",
    name: "testuser",
    emailVerified: true,
    role: role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const account = convertBetterAuthToAccountResult(mockUser);
  return account.authorization;
}

describe("Role Round-Trip", () => {
  describe("mapRoleToAuthorization maps WXYC roles correctly", () => {
    it("maps 'stationManager' to SM", () => {
      expect(mapRoleToAuthorization("stationManager")).toBe(Authorization.SM);
    });

    it("maps 'musicDirector' to MD", () => {
      expect(mapRoleToAuthorization("musicDirector")).toBe(Authorization.MD);
    });

    it("maps 'dj' to DJ", () => {
      expect(mapRoleToAuthorization("dj")).toBe(Authorization.DJ);
    });

    it("maps 'member' to NO", () => {
      expect(mapRoleToAuthorization("member")).toBe(Authorization.NO);
    });
  });

  describe("mapRoleToAuthorization handles Better Auth default roles", () => {
    it("maps 'admin' to SM", () => {
      expect(mapRoleToAuthorization("admin")).toBe(Authorization.SM);
    });

    it("maps 'user' to NO", () => {
      expect(mapRoleToAuthorization("user")).toBe(Authorization.NO);
    });
  });

  describe("Full round-trip preserves role hierarchy", () => {
    it("stationManager round-trips to SM", () => {
      expect(simulateRoleRoundTrip("stationManager")).toBe(Authorization.SM);
    });

    it("musicDirector round-trips to MD", () => {
      expect(simulateRoleRoundTrip("musicDirector")).toBe(Authorization.MD);
    });

    it("dj round-trips to DJ", () => {
      expect(simulateRoleRoundTrip("dj")).toBe(Authorization.DJ);
    });

    it("member round-trips to NO", () => {
      expect(simulateRoleRoundTrip("member")).toBe(Authorization.NO);
    });
  });

  describe("Role hierarchy is preserved (MD and DJ are distinguishable)", () => {
    it("musicDirector and dj map to different authorizations", () => {
      expect(mapRoleToAuthorization("musicDirector")).not.toBe(
        mapRoleToAuthorization("dj")
      );
    });

    it("MD has higher authorization than DJ", () => {
      expect(Authorization.MD).toBeGreaterThan(Authorization.DJ);
    });

    it("SM has higher authorization than MD", () => {
      expect(Authorization.SM).toBeGreaterThan(Authorization.MD);
    });
  });
});
