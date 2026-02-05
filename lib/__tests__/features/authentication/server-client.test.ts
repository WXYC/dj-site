import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store captured config from createAuthClient
let capturedConfig: any = null;

// Mock better-auth/client
vi.mock("better-auth/client", () => ({
  createAuthClient: vi.fn((config) => {
    capturedConfig = config;
    return {
      getSession: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      admin: {},
      $fetch: vi.fn(),
    };
  }),
}));

// Mock better-auth/client/plugins
vi.mock("better-auth/client/plugins", () => ({
  adminClient: vi.fn(() => ({ name: "admin" })),
  usernameClient: vi.fn(() => ({ name: "username" })),
  jwtClient: vi.fn(() => ({ name: "jwt" })),
}));

// Mock next/headers
const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

describe("server-client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedConfig = null;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("serverAuthClient export", () => {
    it("should export serverAuthClient", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      expect(serverAuthClient).toBeDefined();
    });

    it("should have getSession method", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      expect(typeof serverAuthClient.getSession).toBe("function");
    });

    it("should have signIn method", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      expect(typeof serverAuthClient.signIn).toBe("function");
    });

    it("should have signOut method", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      expect(typeof serverAuthClient.signOut).toBe("function");
    });

    it("should have admin property", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      expect(serverAuthClient.admin).toBeDefined();
    });

    it("should have $fetch method for raw API calls", async () => {
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );
      expect(typeof serverAuthClient.$fetch).toBe("function");
    });
  });

  describe("plugin configuration", () => {
    it("should create auth client with admin plugin", async () => {
      const { createAuthClient } = await import("better-auth/client");
      const { adminClient } = await import("better-auth/client/plugins");

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(adminClient).toHaveBeenCalled();
      expect(createAuthClient).toHaveBeenCalled();
    });

    it("should create auth client with username plugin", async () => {
      const { usernameClient } = await import("better-auth/client/plugins");

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(usernameClient).toHaveBeenCalled();
    });

    it("should create auth client with JWT plugin", async () => {
      const { jwtClient } = await import("better-auth/client/plugins");

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(jwtClient).toHaveBeenCalled();
    });

    it("should include all three plugins in configuration", async () => {
      const { createAuthClient } = await import("better-auth/client");

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(createAuthClient).toHaveBeenCalledWith(
        expect.objectContaining({
          plugins: expect.arrayContaining([
            expect.objectContaining({ name: "admin" }),
            expect.objectContaining({ name: "username" }),
            expect.objectContaining({ name: "jwt" }),
          ]),
        })
      );
    });
  });

  describe("base URL configuration", () => {
    it("should use default base URL when env not set", async () => {
      delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

      vi.resetModules();
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );

      expect(serverAuthClient).toBeDefined();
    });

    it("should use env base URL when set", async () => {
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "https://custom-auth.example.com/auth";

      vi.resetModules();
      const { serverAuthClient } = await import(
        "@/lib/features/authentication/server-client"
      );

      expect(serverAuthClient).toBeDefined();
    });
  });

  describe("getBaseURL function behavior", () => {
    it("should construct URL from host header when available", async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "host") return "app.example.com";
          if (name === "x-forwarded-proto") return "https";
          return null;
        },
      });

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      // The baseURL should include /auth suffix
      expect(capturedConfig?.baseURL).toContain("/auth");
    });

    it("should default to https protocol when x-forwarded-proto is not set", async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "host") return "app.example.com";
          return null;
        },
      });

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      // baseURL should use https by default
      expect(capturedConfig?.baseURL).toMatch(/^https:\/\//);
    });

    it("should use http when x-forwarded-proto is http", async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "host") return "localhost:3000";
          if (name === "x-forwarded-proto") return "http";
          return null;
        },
      });

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toMatch(/^http:\/\//);
    });

    it("should fall back to env var when headers() throws", async () => {
      mockHeaders.mockImplementation(() => {
        throw new Error("Headers not available during build");
      });
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "https://fallback.example.com/auth";

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("https://fallback.example.com/auth");
    });

    it("should use default URL when both headers and env are unavailable", async () => {
      mockHeaders.mockImplementation(() => {
        throw new Error("Headers not available during build");
      });
      delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("https://api.wxyc.org/auth");
    });

    it("should handle host without port", async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "host") return "wxyc.org";
          if (name === "x-forwarded-proto") return "https";
          return null;
        },
      });

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("https://wxyc.org/auth");
    });

    it("should handle host with port", async () => {
      mockHeaders.mockResolvedValue({
        get: (name: string) => {
          if (name === "host") return "localhost:3001";
          if (name === "x-forwarded-proto") return "http";
          return null;
        },
      });

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("http://localhost:3001/auth");
    });
  });
});
