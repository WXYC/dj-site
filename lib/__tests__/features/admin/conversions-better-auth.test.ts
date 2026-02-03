import { describe, it, expect, vi } from "vitest";
import {
  convertBetterAuthToAccountResult,
  mapBetterAuthRoleToAuthorization,
  type BetterAuthUser,
} from "@/lib/features/admin/conversions-better-auth";
import { AdminAuthenticationStatus, Authorization } from "@/lib/features/admin/types";

// Mock mapRoleToAuthorization
vi.mock("@/lib/features/authentication/types", () => ({
  mapRoleToAuthorization: vi.fn((role: string) => {
    switch (role) {
      case "stationManager":
        return 3; // Authorization.SM
      case "musicDirector":
        return 2; // Authorization.MD
      case "dj":
        return 1; // Authorization.DJ
      default:
        return 0; // Authorization.None
    }
  }),
}));

describe("conversions-better-auth", () => {
  describe("convertBetterAuthToAccountResult", () => {
    const baseUser: BetterAuthUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      role: "dj",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should convert basic user to account", () => {
      const result = convertBetterAuthToAccountResult(baseUser);

      expect(result.id).toBe("user-123");
      expect(result.email).toBe("test@example.com");
    });

    it("should use username when available", () => {
      const user: BetterAuthUser = {
        ...baseUser,
        username: "testuser",
      };

      const result = convertBetterAuthToAccountResult(user);

      expect(result.userName).toBe("testuser");
    });

    it("should fall back to name when username is not available", () => {
      const result = convertBetterAuthToAccountResult(baseUser);

      expect(result.userName).toBe("Test User");
    });

    it("should use realName when available", () => {
      const user: BetterAuthUser = {
        ...baseUser,
        realName: "Real Name",
      };

      const result = convertBetterAuthToAccountResult(user);

      expect(result.realName).toBe("Real Name");
    });

    it("should fall back to name when realName is not available", () => {
      const result = convertBetterAuthToAccountResult(baseUser);

      expect(result.realName).toBe("Test User");
    });

    it("should fall back to 'No Real Name' when name is not available", () => {
      const user: BetterAuthUser = {
        ...baseUser,
        name: "",
        realName: undefined,
      };

      const result = convertBetterAuthToAccountResult(user);

      expect(result.realName).toBe("No Real Name");
    });

    it("should use djName when available", () => {
      const user: BetterAuthUser = {
        ...baseUser,
        djName: "DJ Cool",
      };

      const result = convertBetterAuthToAccountResult(user);

      expect(result.djName).toBe("DJ Cool");
    });

    it("should fall back to 'No DJ Name' when djName is not available", () => {
      const result = convertBetterAuthToAccountResult(baseUser);

      expect(result.djName).toBe("No DJ Name");
    });

    it("should set authType to Confirmed when email is verified", () => {
      const result = convertBetterAuthToAccountResult(baseUser);

      expect(result.authType).toBe(AdminAuthenticationStatus.Confirmed);
    });

    it("should set authType to New when email is not verified", () => {
      const user: BetterAuthUser = {
        ...baseUser,
        emailVerified: false,
      };

      const result = convertBetterAuthToAccountResult(user);

      expect(result.authType).toBe(AdminAuthenticationStatus.New);
    });

    it("should map dj role to correct authorization", () => {
      const user: BetterAuthUser = {
        ...baseUser,
        role: "dj",
      };

      const result = convertBetterAuthToAccountResult(user);

      expect(result.authorization).toBe(1); // DJ
    });

    it("should map stationManager role to correct authorization", () => {
      const user: BetterAuthUser = {
        ...baseUser,
        role: "stationManager",
      };

      const result = convertBetterAuthToAccountResult(user);

      expect(result.authorization).toBe(3); // SM
    });

    it("should map musicDirector role to correct authorization", () => {
      const user: BetterAuthUser = {
        ...baseUser,
        role: "musicDirector",
      };

      const result = convertBetterAuthToAccountResult(user);

      expect(result.authorization).toBe(2); // MD
    });

    it("should map member role to None authorization", () => {
      const user: BetterAuthUser = {
        ...baseUser,
        role: "member",
      };

      const result = convertBetterAuthToAccountResult(user);

      expect(result.authorization).toBe(0); // None
    });
  });

  describe("mapBetterAuthRoleToAuthorization", () => {
    it("should map stationManager to SM authorization", () => {
      const result = mapBetterAuthRoleToAuthorization("stationManager");
      expect(result).toBe(3);
    });

    it("should map musicDirector to MD authorization", () => {
      const result = mapBetterAuthRoleToAuthorization("musicDirector");
      expect(result).toBe(2);
    });

    it("should map dj to DJ authorization", () => {
      const result = mapBetterAuthRoleToAuthorization("dj");
      expect(result).toBe(1);
    });

    it("should map member to None authorization", () => {
      const result = mapBetterAuthRoleToAuthorization("member");
      expect(result).toBe(0);
    });
  });
});
