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
  organizationClient: vi.fn(() => ({ name: "organization" })),
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
          { name: "organization" },
        ],
      });
      expect(capturedConfig.baseURL).toBeDefined();
    });
  });

  describe("getBaseURL function behavior", () => {
    it("should use env var when NEXT_PUBLIC_BETTER_AUTH_URL is set", async () => {
      process.env = { ...originalEnv, NEXT_PUBLIC_BETTER_AUTH_URL: "https://custom.example.com/auth" };

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("https://custom.example.com/auth");
    });

    it("should use default URL when env var is not set", async () => {
      process.env = { ...originalEnv };
      delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("https://api.wxyc.org/auth");
    });
  });
});
