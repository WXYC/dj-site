import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/headers
const mockGet = vi.fn();
const mockToString = vi.fn(() => "session=test-cookie");
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: mockGet,
    toString: mockToString,
  })),
}));

// Mock server auth client
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: vi.fn(),
  },
}));

// Mock preferences
vi.mock("@/lib/features/experiences/preferences", () => ({
  parseAppSkinPreference: vi.fn(),
}));

// Mock authentication utilities
vi.mock("@/lib/features/authentication/utilities", () => ({
  defaultAuthenticationData: { message: "Not Authenticated" },
  betterAuthSessionToAuthenticationData: vi.fn(() => ({
    message: "Not Authenticated",
  })),
}));

// Mock application types
vi.mock("@/lib/features/application/types", () => ({
  defaultApplicationState: {
    experience: "modern",
    colorMode: "light",
  },
}));

describe("session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(undefined);
  });

  describe("sessionOptions", () => {
    it("should have correct cookie options", async () => {
      const { sessionOptions } = await import("@/lib/features/session");

      expect(sessionOptions.cookieOptions.path).toBe("/");
      expect(sessionOptions.cookieOptions.sameSite).toBe("lax");
    });
  });

  describe("createServerSideProps", () => {
    it("should return default props when no cookies set", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: null,
      } as any);

      const { createServerSideProps } = await import("@/lib/features/session");
      const result = await createServerSideProps();

      expect(result).toHaveProperty("application");
      expect(result).toHaveProperty("authentication");
    });

    it("should parse app_state cookie", async () => {
      mockGet.mockReturnValue({
        value: JSON.stringify({ experience: "classic", colorMode: "dark" }),
      });

      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: null,
      } as any);

      const { createServerSideProps } = await import("@/lib/features/session");
      const result = await createServerSideProps();

      expect(result.application.experience).toBe("classic");
      expect(result.application.colorMode).toBe("dark");
    });

    it("should migrate old classic boolean to experience string", async () => {
      mockGet.mockReturnValue({
        value: JSON.stringify({ classic: true }),
      });

      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: null,
      } as any);

      const { createServerSideProps } = await import("@/lib/features/session");
      const result = await createServerSideProps();

      expect(result.application.experience).toBe("classic");
    });

    it("should handle invalid JSON in app_state cookie", async () => {
      mockGet.mockReturnValue({
        value: "invalid json{",
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: null,
      } as any);

      const { createServerSideProps } = await import("@/lib/features/session");
      const result = await createServerSideProps();

      expect(result.application).toBeDefined();
      consoleSpy.mockRestore();
    });

    it("should handle session fetch error gracefully", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      vi.mocked(serverAuthClient.getSession).mockRejectedValue(
        new Error("Network error")
      );

      const { createServerSideProps } = await import("@/lib/features/session");
      const result = await createServerSideProps();

      expect(result.authentication).toEqual({ message: "Not Authenticated" });
    });

    it("should process valid session data", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      const { betterAuthSessionToAuthenticationData } = await import(
        "@/lib/features/authentication/utilities"
      );

      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
            name: "Test User",
            role: "dj",
          },
          session: {
            id: "session-123",
            userId: "user-123",
            expiresAt: new Date(),
          },
        },
      } as any);

      vi.mocked(betterAuthSessionToAuthenticationData).mockReturnValue({
        user: { id: "user-123" },
      } as any);

      const { createServerSideProps } = await import("@/lib/features/session");
      const result = await createServerSideProps();

      expect(betterAuthSessionToAuthenticationData).toHaveBeenCalled();
    });

    it("should apply user appSkin preference to application state", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      const { parseAppSkinPreference } = await import(
        "@/lib/features/experiences/preferences"
      );

      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
            name: "Test User",
            appSkin: "classic-dark",
          },
          session: {
            id: "session-123",
            userId: "user-123",
            expiresAt: new Date(),
          },
        },
      } as any);

      vi.mocked(parseAppSkinPreference).mockReturnValue({
        experience: "classic",
        colorMode: "dark",
      });

      const { createServerSideProps } = await import("@/lib/features/session");
      const result = await createServerSideProps();

      expect(result.application.experience).toBe("classic");
      expect(result.application.colorMode).toBe("dark");
    });
  });

  describe("runtime", () => {
    it("should export edge runtime", async () => {
      const { runtime } = await import("@/lib/features/session");
      expect(runtime).toBe("edge");
    });
  });
});
