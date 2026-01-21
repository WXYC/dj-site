import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  convertAWSToAccountResult,
  convertBackendStatusToAuthentication,
  getGroupNameFromAuthorization,
} from "@/lib/features/admin/conversions";
import {
  AdminAuthenticationStatus,
  Authorization,
} from "@/lib/features/admin/types";
import { createTestAWSUser } from "@/lib/test-utils";

describe("admin conversions", () => {
  describe("convertBackendStatusToAuthentication", () => {
    it("should convert CONFIRMED to Confirmed", () => {
      const result = convertBackendStatusToAuthentication("CONFIRMED");
      expect(result).toBe(AdminAuthenticationStatus.Confirmed);
    });

    it("should convert FORCE_CHANGE_PASSWORD to New", () => {
      const result = convertBackendStatusToAuthentication("FORCE_CHANGE_PASSWORD");
      expect(result).toBe(AdminAuthenticationStatus.New);
    });

    it("should convert RESET_REQUIRED to Reset", () => {
      const result = convertBackendStatusToAuthentication("RESET_REQUIRED");
      expect(result).toBe(AdminAuthenticationStatus.Reset);
    });

    it("should default to New for undefined", () => {
      const result = convertBackendStatusToAuthentication(undefined);
      expect(result).toBe(AdminAuthenticationStatus.New);
    });

    it("should default to New for unknown status", () => {
      const result = convertBackendStatusToAuthentication("UNKNOWN" as any);
      expect(result).toBe(AdminAuthenticationStatus.New);
    });
  });

  describe("convertAWSToAccountResult", () => {
    it("should extract username from backend", () => {
      const user = createTestAWSUser({ Username: "djcool" });
      const result = convertAWSToAccountResult(user, [], []);
      expect(result.userName).toBe("djcool");
    });

    it("should extract real name from attributes", () => {
      const user = createTestAWSUser({
        Attributes: [
          { Name: "name", Value: "John Smith" },
          { Name: "custom:dj-name", Value: "DJ Cool" },
          { Name: "email", Value: "test@test.com" },
        ],
      });
      const result = convertAWSToAccountResult(user, [], []);
      expect(result.realName).toBe("John Smith");
    });

    it("should extract DJ name from attributes", () => {
      const user = createTestAWSUser({
        Attributes: [
          { Name: "name", Value: "John Smith" },
          { Name: "custom:dj-name", Value: "DJ Awesome" },
          { Name: "email", Value: "test@test.com" },
        ],
      });
      const result = convertAWSToAccountResult(user, [], []);
      expect(result.djName).toBe("DJ Awesome");
    });

    it("should extract email from attributes", () => {
      const user = createTestAWSUser({
        Attributes: [
          { Name: "name", Value: "John Smith" },
          { Name: "custom:dj-name", Value: "DJ Cool" },
          { Name: "email", Value: "john@wxyc.org" },
        ],
      });
      const result = convertAWSToAccountResult(user, [], []);
      expect(result.email).toBe("john@wxyc.org");
    });

    it("should assign SM authorization for station managers", () => {
      const user = createTestAWSUser({ Username: "smuser" });
      const result = convertAWSToAccountResult(user, ["smuser"], []);
      expect(result.authorization).toBe(Authorization.SM);
    });

    it("should assign MD authorization for music directors", () => {
      const user = createTestAWSUser({ Username: "mduser" });
      const result = convertAWSToAccountResult(user, [], ["mduser"]);
      expect(result.authorization).toBe(Authorization.MD);
    });

    it("should assign DJ authorization for regular users", () => {
      const user = createTestAWSUser({ Username: "djuser" });
      const result = convertAWSToAccountResult(user, [], []);
      expect(result.authorization).toBe(Authorization.DJ);
    });

    it("should prioritize SM over MD authorization", () => {
      const user = createTestAWSUser({ Username: "bothuser" });
      const result = convertAWSToAccountResult(user, ["bothuser"], ["bothuser"]);
      expect(result.authorization).toBe(Authorization.SM);
    });

    it("should assign NO authorization when username is undefined", () => {
      // Directly create user object to bypass fixture's nullish coalescing
      const user = { Username: undefined, UserStatus: "CONFIRMED" as const, Attributes: [] };
      const result = convertAWSToAccountResult(user, [], []);
      expect(result.authorization).toBe(Authorization.NO);
    });

    it("should convert user status correctly", () => {
      const user = createTestAWSUser({ UserStatus: "CONFIRMED" });
      const result = convertAWSToAccountResult(user, [], []);
      expect(result.authType).toBe(AdminAuthenticationStatus.Confirmed);
    });

    it("should handle missing attributes gracefully", () => {
      const user = { Username: "testuser", UserStatus: "CONFIRMED", Attributes: [] };
      const result = convertAWSToAccountResult(user, [], []);
      expect(result.realName).toBe("No Real Name");
      expect(result.djName).toBe("No DJ Name");
      expect(result.email).toBeUndefined();
    });

    it("should handle missing Username with error message", () => {
      const user = { Username: undefined, UserStatus: "CONFIRMED", Attributes: [] };
      const result = convertAWSToAccountResult(user, [], []);
      expect(result.userName).toBe("Error: No Username");
    });
  });

  describe("getGroupNameFromAuthorization", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = {
        ...originalEnv,
        AWS_SM_GROUP_NAME: "test-station-management",
        AWS_MD_GROUP_NAME: "test-music-directors",
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return SM group name for SM authorization", () => {
      const result = getGroupNameFromAuthorization(Authorization.SM);
      expect(result).toBe("test-station-management");
    });

    it("should return MD group name for MD authorization", () => {
      const result = getGroupNameFromAuthorization(Authorization.MD);
      expect(result).toBe("test-music-directors");
    });

    it("should return undefined for DJ authorization", () => {
      const result = getGroupNameFromAuthorization(Authorization.DJ);
      expect(result).toBeUndefined();
    });

    it("should return undefined for NO authorization", () => {
      const result = getGroupNameFromAuthorization(Authorization.NO);
      expect(result).toBeUndefined();
    });
  });
});
