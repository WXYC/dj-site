import { describe, it, expect, vi, beforeEach } from "vitest";
import { Authorization } from "@/lib/features/admin/types";
import type { DJwtPayload } from "@/lib/features/authentication/types";

// Mock jwt-decode before importing the module under test
vi.mock("jwt-decode", () => ({
  jwtDecode: vi.fn(),
}));

import { toClient, toUser, defaultAuthenticationData } from "@/lib/features/authentication/utilities";
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

  describe("toUser", () => {
    const createMockPayload = (overrides: Partial<DJwtPayload> = {}): DJwtPayload => ({
      "cognito:username": "testuser",
      email: "test@wxyc.org",
      name: "Test User",
      "custom:dj-name": "DJ Test",
      "cognito:groups": [],
      ...overrides,
    });

    it("should extract username from token", () => {
      const payload = createMockPayload({ "cognito:username": "myuser" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUser("fake-token");

      expect(result.username).toBe("myuser");
      expect(mockedJwtDecode).toHaveBeenCalledWith("fake-token");
    });

    it("should extract email from token", () => {
      const payload = createMockPayload({ email: "dj@station.org" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUser("fake-token");

      expect(result.email).toBe("dj@station.org");
    });

    it("should extract realName from token", () => {
      const payload = createMockPayload({ name: "John Smith" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUser("fake-token");

      expect(result.realName).toBe("John Smith");
    });

    it("should extract djName from token", () => {
      const payload = createMockPayload({ "custom:dj-name": "DJ Awesome" });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUser("fake-token");

      expect(result.djName).toBe("DJ Awesome");
    });

    it("should assign SM authority for station-management group", () => {
      const payload = createMockPayload({
        "cognito:groups": ["station-management"],
      });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUser("fake-token");

      expect(result.authority).toBe(Authorization.SM);
    });

    it("should assign MD authority for music-directors group", () => {
      const payload = createMockPayload({
        "cognito:groups": ["music-directors"],
      });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUser("fake-token");

      expect(result.authority).toBe(Authorization.MD);
    });

    it("should assign DJ authority when no special groups", () => {
      const payload = createMockPayload({
        "cognito:groups": [],
      });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUser("fake-token");

      expect(result.authority).toBe(Authorization.DJ);
    });

    it("should assign DJ authority when cognito:groups is undefined", () => {
      const payload = createMockPayload({
        "cognito:groups": undefined,
      });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUser("fake-token");

      expect(result.authority).toBe(Authorization.DJ);
    });

    it("should prioritize SM over MD when user is in both groups", () => {
      const payload = createMockPayload({
        "cognito:groups": ["station-management", "music-directors"],
      });
      mockedJwtDecode.mockReturnValue(payload);

      const result = toUser("fake-token");

      expect(result.authority).toBe(Authorization.SM);
    });
  });

  describe("toClient", () => {
    const createMockPayload = (overrides: Partial<DJwtPayload> = {}): DJwtPayload => ({
      "cognito:username": "testuser",
      email: "test@wxyc.org",
      name: "Test User",
      "custom:dj-name": "DJ Test",
      "cognito:groups": [],
      ...overrides,
    });

    it("should return authenticated user when AuthenticationResult present", () => {
      const payload = createMockPayload();
      mockedJwtDecode.mockReturnValue(payload);

      const data = {
        AuthenticationResult: {
          IdToken: "id-token-123",
          AccessToken: "access-token-456",
        },
      };

      const result = toClient(data);

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe("access-token-456");
      expect(result.idToken).toBe("id-token-123");
    });

    it("should extract user data from IdToken", () => {
      const payload = createMockPayload({
        "cognito:username": "djcool",
        email: "cool@wxyc.org",
      });
      mockedJwtDecode.mockReturnValue(payload);

      const data = {
        AuthenticationResult: {
          IdToken: "id-token-123",
          AccessToken: "access-token-456",
        },
      };

      const result = toClient(data);

      expect(result.user?.username).toBe("djcool");
      expect(result.user?.email).toBe("cool@wxyc.org");
    });

    it("should return NEW_PASSWORD_REQUIRED challenge data", () => {
      const data = {
        ChallengeName: "NEW_PASSWORD_REQUIRED" as const,
        ChallengeParameters: {
          USER_ID_FOR_SRP: "newuser",
          name: "Some Name",
        },
      };

      const result = toClient(data);

      expect(result.username).toBe("newuser");
      expect(result.requiredAttributes).toBeDefined();
    });

    it("should identify missing attributes for NEW_PASSWORD_REQUIRED", () => {
      const data = {
        ChallengeName: "NEW_PASSWORD_REQUIRED" as const,
        ChallengeParameters: {
          USER_ID_FOR_SRP: "newuser",
          // 'name' is present, so 'realName' should NOT be in requiredAttributes
          // 'custom:dj-name' is missing, so 'djName' SHOULD be in requiredAttributes
          name: "John Doe",
        },
      };

      const result = toClient(data);

      expect(result.requiredAttributes).toContain("djName");
      expect(result.requiredAttributes).not.toContain("realName");
    });

    it("should return empty object when no AuthenticationResult or Challenge", () => {
      const data = {};

      const result = toClient(data);

      expect(result).toEqual({});
    });

    it("should return empty object when AuthenticationResult missing IdToken", () => {
      const data = {
        AuthenticationResult: {
          AccessToken: "access-token-456",
        },
      };

      const result = toClient(data);

      expect(result).toEqual({});
    });

    it("should return empty object when AuthenticationResult missing AccessToken", () => {
      const data = {
        AuthenticationResult: {
          IdToken: "id-token-123",
        },
      };

      const result = toClient(data);

      expect(result).toEqual({});
    });

    it("should handle NEW_PASSWORD_REQUIRED without ChallengeParameters", () => {
      const data = {
        ChallengeName: "NEW_PASSWORD_REQUIRED" as const,
      };

      const result = toClient(data);

      // Should not crash, and should return empty object
      expect(result).toEqual({});
    });
  });
});
