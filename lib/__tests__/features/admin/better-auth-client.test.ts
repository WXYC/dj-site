import { describe, it, expect, vi, beforeEach } from "vitest";
import { Authorization } from "@/lib/features/admin/types";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    toString: () => "session=test-cookie",
  })),
}));

// Mock server auth client
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: vi.fn(),
  },
}));

// Mock utilities
vi.mock("@/lib/features/authentication/utilities", () => ({
  betterAuthSessionToAuthenticationData: vi.fn(),
}));

// Mock types
vi.mock("@/lib/features/authentication/types", () => ({
  isAuthenticated: vi.fn(),
}));

describe("better-auth-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyAdminAccess", () => {
    it("should throw error when session data is null", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: null,
      } as any);

      const { verifyAdminAccess } = await import(
        "@/lib/features/admin/better-auth-client"
      );

      await expect(verifyAdminAccess()).rejects.toThrow(
        "User is not authenticated"
      );
    });

    it("should throw error when user is not authenticated", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      const { betterAuthSessionToAuthenticationData } = await import(
        "@/lib/features/authentication/utilities"
      );
      const { isAuthenticated } = await import(
        "@/lib/features/authentication/types"
      );

      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: { user: { id: "test" } },
      } as any);
      vi.mocked(betterAuthSessionToAuthenticationData).mockReturnValue({
        message: "Not Authenticated",
      });
      vi.mocked(isAuthenticated).mockReturnValue(false);

      const { verifyAdminAccess } = await import(
        "@/lib/features/admin/better-auth-client"
      );

      await expect(verifyAdminAccess()).rejects.toThrow(
        "User is not authenticated"
      );
    });

    it("should throw error when user is not an admin", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      const { betterAuthSessionToAuthenticationData } = await import(
        "@/lib/features/authentication/utilities"
      );
      const { isAuthenticated } = await import(
        "@/lib/features/authentication/types"
      );

      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: { user: { id: "test" } },
      } as any);
      vi.mocked(betterAuthSessionToAuthenticationData).mockReturnValue({
        user: { authority: Authorization.DJ },
      } as any);
      vi.mocked(isAuthenticated).mockReturnValue(true);

      const { verifyAdminAccess } = await import(
        "@/lib/features/admin/better-auth-client"
      );

      await expect(verifyAdminAccess()).rejects.toThrow(
        "User does not have admin privileges"
      );
    });

    it("should not throw when user is a station manager", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      const { betterAuthSessionToAuthenticationData } = await import(
        "@/lib/features/authentication/utilities"
      );
      const { isAuthenticated } = await import(
        "@/lib/features/authentication/types"
      );

      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: { user: { id: "test" } },
      } as any);
      vi.mocked(betterAuthSessionToAuthenticationData).mockReturnValue({
        user: { authority: Authorization.SM },
      } as any);
      vi.mocked(isAuthenticated).mockReturnValue(true);

      const { verifyAdminAccess } = await import(
        "@/lib/features/admin/better-auth-client"
      );

      await expect(verifyAdminAccess()).resolves.not.toThrow();
    });
  });

  describe("getBetterAuthAdminClient", () => {
    it("should return serverAuthClient when admin access verified", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      const { betterAuthSessionToAuthenticationData } = await import(
        "@/lib/features/authentication/utilities"
      );
      const { isAuthenticated } = await import(
        "@/lib/features/authentication/types"
      );

      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: { user: { id: "test" } },
      } as any);
      vi.mocked(betterAuthSessionToAuthenticationData).mockReturnValue({
        user: { authority: Authorization.SM },
      } as any);
      vi.mocked(isAuthenticated).mockReturnValue(true);

      const { getBetterAuthAdminClient } = await import(
        "@/lib/features/admin/better-auth-client"
      );

      const result = await getBetterAuthAdminClient();
      expect(result).toBe(serverAuthClient);
    });

    it("should throw error when admin access not verified", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );

      vi.mocked(serverAuthClient.getSession).mockResolvedValue({
        data: null,
      } as any);

      const { getBetterAuthAdminClient } = await import(
        "@/lib/features/admin/better-auth-client"
      );

      await expect(getBetterAuthAdminClient()).rejects.toThrow(
        "User is not authenticated"
      );
    });
  });
});
