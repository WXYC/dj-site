import { describe, it, expect } from "vitest";
import {
  isAuthenticated,
  isIncomplete,
  isPasswordReset,
  mapRoleToAuthorization,
  djAttributeNames,
  djAttributeTitles,
  modifiableAttributeNames,
} from "@/lib/features/authentication/types";
import { Authorization } from "@/lib/features/admin/types";
import type {
  AuthenticationData,
  AuthenticatedUser,
  IncompleteUser,
  PasswordResetUser,
} from "@/lib/features/authentication/types";

describe("authentication types", () => {
  describe("isAuthenticated", () => {
    it("should return true for authenticated user with user object", () => {
      const data: AuthenticatedUser = {
        user: {
          username: "testuser",
          email: "test@example.com",
          authority: Authorization.DJ,
        },
        accessToken: "token123",
      };
      expect(isAuthenticated(data)).toBe(true);
    });

    it("should return false for 'Not Authenticated' message", () => {
      const data: AuthenticationData = { message: "Not Authenticated" };
      expect(isAuthenticated(data)).toBe(false);
    });

    it("should return false for incomplete user", () => {
      const data: IncompleteUser = {
        username: "testuser",
        requiredAttributes: ["realName", "djName"],
      };
      expect(isAuthenticated(data)).toBe(false);
    });

    it("should return false for password reset user", () => {
      const data: PasswordResetUser = {
        confirmationMessage: "Check your email",
      };
      expect(isAuthenticated(data)).toBe(false);
    });

    it("should return true even without accessToken if user exists", () => {
      const data: AuthenticatedUser = {
        user: {
          username: "testuser",
          email: "test@example.com",
          authority: Authorization.DJ,
        },
      };
      expect(isAuthenticated(data)).toBe(true);
    });

    it("should return false for empty object", () => {
      const data = {} as AuthenticationData;
      expect(isAuthenticated(data)).toBe(false);
    });
  });

  describe("isIncomplete", () => {
    it("should return true for incomplete user with required attributes", () => {
      const data: IncompleteUser = {
        username: "testuser",
        requiredAttributes: ["realName", "djName"],
      };
      expect(isIncomplete(data)).toBe(true);
    });

    it("should return true for incomplete user with empty required attributes", () => {
      const data: IncompleteUser = {
        username: "testuser",
        requiredAttributes: [],
      };
      expect(isIncomplete(data)).toBe(true);
    });

    it("should return false for authenticated user", () => {
      const data: AuthenticatedUser = {
        user: {
          username: "testuser",
          email: "test@example.com",
          authority: Authorization.DJ,
        },
      };
      expect(isIncomplete(data)).toBe(false);
    });

    it("should return false for 'Not Authenticated' message", () => {
      const data: AuthenticationData = { message: "Not Authenticated" };
      expect(isIncomplete(data)).toBe(false);
    });

    it("should return false for password reset user", () => {
      const data: PasswordResetUser = {
        confirmationMessage: "Check your email",
      };
      expect(isIncomplete(data)).toBe(false);
    });
  });

  describe("isPasswordReset", () => {
    it("should return true for password reset user with confirmation message", () => {
      const data: PasswordResetUser = {
        confirmationMessage: "Password reset email sent",
      };
      expect(isPasswordReset(data)).toBe(true);
    });

    it("should return true for password reset user with token", () => {
      const data: PasswordResetUser = {
        confirmationMessage: "Enter new password",
        token: "reset-token-123",
      };
      expect(isPasswordReset(data)).toBe(true);
    });

    it("should return true for password reset user with error", () => {
      const data: PasswordResetUser = {
        confirmationMessage: "Reset failed",
        error: "Token expired",
      };
      expect(isPasswordReset(data)).toBe(true);
    });

    it("should return false for authenticated user", () => {
      const data: AuthenticatedUser = {
        user: {
          username: "testuser",
          email: "test@example.com",
          authority: Authorization.DJ,
        },
      };
      expect(isPasswordReset(data)).toBe(false);
    });

    it("should return false for incomplete user", () => {
      const data: IncompleteUser = {
        username: "testuser",
        requiredAttributes: ["realName"],
      };
      expect(isPasswordReset(data)).toBe(false);
    });

    it("should return false for 'Not Authenticated' message", () => {
      const data: AuthenticationData = { message: "Not Authenticated" };
      expect(isPasswordReset(data)).toBe(false);
    });
  });

  describe("mapRoleToAuthorization", () => {
    describe("station manager roles", () => {
      it.each([
        ["stationManager", Authorization.SM],
        ["stationmanager", Authorization.SM],
        ["station_manager", Authorization.SM],
        ["STATIONMANAGER", Authorization.SM],
        ["  stationManager  ", Authorization.SM],
      ])('should map "%s" to SM', (role, expected) => {
        expect(mapRoleToAuthorization(role)).toBe(expected);
      });
    });

    describe("music director roles", () => {
      it.each([
        ["musicDirector", Authorization.MD],
        ["musicdirector", Authorization.MD],
        ["music_director", Authorization.MD],
        ["music-director", Authorization.MD],
        ["MUSICDIRECTOR", Authorization.MD],
      ])('should map "%s" to MD', (role, expected) => {
        expect(mapRoleToAuthorization(role)).toBe(expected);
      });
    });

    describe("DJ roles", () => {
      it.each([
        ["dj", Authorization.DJ],
        ["DJ", Authorization.DJ],
        ["Dj", Authorization.DJ],
        ["  dj  ", Authorization.DJ],
      ])('should map "%s" to DJ', (role, expected) => {
        expect(mapRoleToAuthorization(role)).toBe(expected);
      });
    });

    describe("member/no access roles", () => {
      it.each([
        ["member", Authorization.NO],
        ["Member", Authorization.NO],
        ["MEMBER", Authorization.NO],
        ["user", Authorization.NO],
        ["User", Authorization.NO],
      ])('should map "%s" to NO', (role, expected) => {
        expect(mapRoleToAuthorization(role)).toBe(expected);
      });
    });

    describe("admin roles", () => {
      it.each([
        ["owner", Authorization.SM],
        ["Owner", Authorization.SM],
        ["admin", Authorization.SM],
        ["Admin", Authorization.SM],
      ])('should map "%s" to SM (full access)', (role, expected) => {
        expect(mapRoleToAuthorization(role)).toBe(expected);
      });
    });

    describe("edge cases", () => {
      it("should return NO for undefined role", () => {
        expect(mapRoleToAuthorization(undefined)).toBe(Authorization.NO);
      });

      it("should return NO for empty string", () => {
        expect(mapRoleToAuthorization("")).toBe(Authorization.NO);
      });

      it("should return NO for unknown role", () => {
        expect(mapRoleToAuthorization("unknown_role")).toBe(Authorization.NO);
      });

      it("should return NO for whitespace-only string", () => {
        expect(mapRoleToAuthorization("   ")).toBe(Authorization.NO);
      });
    });
  });

  describe("djAttributeNames", () => {
    it("should map 'name' to 'realName'", () => {
      expect(djAttributeNames["name"]).toBe("realName");
    });

    it("should map 'custom:dj-name' to 'djName'", () => {
      expect(djAttributeNames["custom:dj-name"]).toBe("djName");
    });
  });

  describe("djAttributeTitles", () => {
    it("should have correct titles for each attribute", () => {
      expect(djAttributeTitles.realName).toBe("Real Name");
      expect(djAttributeTitles.djName).toBe("DJ Name");
      expect(djAttributeTitles.username).toBe("Username");
      expect(djAttributeTitles.password).toBe("Password");
      expect(djAttributeTitles.code).toBe("Code");
      expect(djAttributeTitles.confirmPassword).toBe("Confirm Password");
    });
  });

  describe("modifiableAttributeNames", () => {
    it("should map realName to 'name'", () => {
      expect(modifiableAttributeNames.realName).toBe("name");
    });

    it("should map djName to 'custom:dj-name'", () => {
      expect(modifiableAttributeNames.djName).toBe("custom:dj-name");
    });

    it("should map email to 'email'", () => {
      expect(modifiableAttributeNames.email).toBe("email");
    });
  });
});
