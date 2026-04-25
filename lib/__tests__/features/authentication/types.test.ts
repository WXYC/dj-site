import { describe, it, expect } from "vitest";
import {
  isAuthenticated,
  isIncomplete,
  isPasswordReset,
  djAttributeTitles,
} from "@/lib/features/authentication/types";
import type {
  AuthenticationData,
  AuthenticatedUser,
  IncompleteUser,
  PasswordResetUser,
} from "@/lib/features/authentication/types";
import {
  createTestAuthenticatedUser,
  createTestIncompleteUser,
  createTestPasswordResetUser,
} from "@/lib/test-utils";

describe("authentication types", () => {
  describe("isAuthenticated", () => {
    it("should return true for authenticated user with user object", () => {
      const data: AuthenticatedUser = createTestAuthenticatedUser();
      expect(isAuthenticated(data)).toBe(true);
    });

    it("should return false for 'Not Authenticated' message", () => {
      const data: AuthenticationData = { message: "Not Authenticated" };
      expect(isAuthenticated(data)).toBe(false);
    });

    it("should return false for incomplete user", () => {
      const data: IncompleteUser = createTestIncompleteUser();
      expect(isAuthenticated(data)).toBe(false);
    });

    it("should return false for password reset user", () => {
      const data: PasswordResetUser = createTestPasswordResetUser();
      expect(isAuthenticated(data)).toBe(false);
    });

    it("should return true even without accessToken if user exists", () => {
      const data: AuthenticatedUser = createTestAuthenticatedUser({
        accessToken: undefined,
        token: undefined,
      });
      expect(isAuthenticated(data)).toBe(true);
    });

    it("should return false for empty object", () => {
      const data = {} as AuthenticationData;
      expect(isAuthenticated(data)).toBe(false);
    });
  });

  describe("isIncomplete", () => {
    it("should return true for incomplete user with required attributes", () => {
      const data: IncompleteUser = createTestIncompleteUser();
      expect(isIncomplete(data)).toBe(true);
    });

    it("should return true for incomplete user with empty required attributes", () => {
      const data: IncompleteUser = createTestIncompleteUser({
        requiredAttributes: [],
      });
      expect(isIncomplete(data)).toBe(true);
    });

    it("should return false for authenticated user", () => {
      const data: AuthenticatedUser = createTestAuthenticatedUser();
      expect(isIncomplete(data)).toBe(false);
    });

    it("should return false for 'Not Authenticated' message", () => {
      const data: AuthenticationData = { message: "Not Authenticated" };
      expect(isIncomplete(data)).toBe(false);
    });

    it("should return false for password reset user", () => {
      const data: PasswordResetUser = createTestPasswordResetUser();
      expect(isIncomplete(data)).toBe(false);
    });
  });

  describe("isPasswordReset", () => {
    it("should return true for password reset user with confirmation message", () => {
      const data: PasswordResetUser = createTestPasswordResetUser();
      expect(isPasswordReset(data)).toBe(true);
    });

    it("should return true for password reset user with token", () => {
      const data: PasswordResetUser = createTestPasswordResetUser({
        token: "reset-token-123",
      });
      expect(isPasswordReset(data)).toBe(true);
    });

    it("should return true for password reset user with error", () => {
      const data: PasswordResetUser = createTestPasswordResetUser({
        confirmationMessage: "Reset failed",
        error: "Token expired",
      });
      expect(isPasswordReset(data)).toBe(true);
    });

    it("should return false for authenticated user", () => {
      const data: AuthenticatedUser = createTestAuthenticatedUser();
      expect(isPasswordReset(data)).toBe(false);
    });

    it("should return false for incomplete user", () => {
      const data: IncompleteUser = createTestIncompleteUser({
        requiredAttributes: ["realName"],
      });
      expect(isPasswordReset(data)).toBe(false);
    });

    it("should return false for 'Not Authenticated' message", () => {
      const data: AuthenticationData = { message: "Not Authenticated" };
      expect(isPasswordReset(data)).toBe(false);
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
});
