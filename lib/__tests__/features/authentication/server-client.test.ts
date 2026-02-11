import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let capturedConfig: any = null;

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

vi.mock("better-auth/client/plugins", () => ({
  adminClient: vi.fn(() => ({ name: "admin" })),
  usernameClient: vi.fn(() => ({ name: "username" })),
  jwtClient: vi.fn(() => ({ name: "jwt" })),
}));

const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

describe("server-client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedConfig = null;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("client configuration", () => {
    it("should configure createAuthClient with plugins, credentials, and baseURL", async () => {
      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig).toMatchObject({
        plugins: [
          { name: "admin" },
          { name: "username" },
          { name: "jwt" },
        ],
      });
      expect(capturedConfig.baseURL).toBeDefined();
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
      process.env = { ...originalEnv, NEXT_PUBLIC_BETTER_AUTH_URL: "https://fallback.example.com/auth" };

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("https://fallback.example.com/auth");
    });

    it("should use default URL when both headers and env are unavailable", async () => {
      mockHeaders.mockImplementation(() => {
        throw new Error("Headers not available during build");
      });
      process.env = { ...originalEnv };
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
