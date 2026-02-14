import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let capturedConfig: any = null;

vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn((config) => {
    capturedConfig = config;
    return {
      useSession: vi.fn(),
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

describe("authentication client", () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedConfig = null;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    if (originalWindow !== undefined) {
      (global as any).window = originalWindow;
    }
  });

  describe("getJWTToken", () => {
    it("should return token when fetch succeeds", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "test-jwt-token" }),
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBe("test-jwt-token");
    });

    it("should return null when response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();
    });

    it("should return null when response status is 403", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();
    });

    it("should return null when response status is 500", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();
    });

    it("should return null when token is not in response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();
    });

    it("should return null when token is null in response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: null }),
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();
    });

    it("should return null when token is undefined in response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: undefined }),
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();
    });

    it("should return null on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to get JWT token:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should return null on JSON parse error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to get JWT token:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should return null on fetch timeout", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Request timed out"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();

      consoleSpy.mockRestore();
    });

    it("should make fetch request with credentials include", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      await getJWTToken();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/token"),
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
    });

    it("should call fetch exactly once per invocation", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      await getJWTToken();
      await getJWTToken();

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should return null for empty string token", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "" }),
      });

      const { getJWTToken } = await import(
        "@/lib/features/authentication/client"
      );
      const token = await getJWTToken();

      expect(token).toBeNull();
    });
  });

  describe("client configuration", () => {
    it("should configure createAuthClient with plugins, credentials, and baseURL", async () => {
      vi.resetModules();
      await import("@/lib/features/authentication/client");

      expect(capturedConfig).toMatchObject({
        fetchOptions: { credentials: "include" },
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
    describe("in browser environment", () => {
      beforeEach(() => {
        (global as any).window = {
          location: {
            origin: "https://app.example.com",
          },
        };
      });

      afterEach(() => {
        delete (global as any).window;
      });

      it("should use same-origin /auth path when envURL origin differs from window.location", async () => {
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "https://different.example.com/auth";

        vi.resetModules();
        await import("@/lib/features/authentication/client");

        expect(capturedConfig?.baseURL).toBe("https://app.example.com/auth");
      });

      it("should use envURL when origin matches window.location", async () => {
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "https://app.example.com/auth";

        vi.resetModules();
        await import("@/lib/features/authentication/client");

        expect(capturedConfig?.baseURL).toBe("https://app.example.com/auth");
      });

      it("should use same-origin /auth path when no envURL is set", async () => {
        delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

        vi.resetModules();
        await import("@/lib/features/authentication/client");

        expect(capturedConfig?.baseURL).toBe("https://app.example.com/auth");
      });

      it("should handle relative path envURL starting with /", async () => {
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "/custom-auth";

        vi.resetModules();
        await import("@/lib/features/authentication/client");

        expect(capturedConfig?.baseURL).toBe("https://app.example.com/custom-auth");
      });

      it("should use same-origin /auth path for invalid envURL", async () => {
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "not-a-valid-url";

        vi.resetModules();
        await import("@/lib/features/authentication/client");

        expect(capturedConfig?.baseURL).toBe("https://app.example.com/auth");
      });
    });

    describe("in server environment (no window)", () => {
      beforeEach(() => {
        delete (global as any).window;
      });

      it("should use envURL when set", async () => {
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "https://api.wxyc.org/auth";

        vi.resetModules();
        await import("@/lib/features/authentication/client");

        expect(capturedConfig?.baseURL).toBe("https://api.wxyc.org/auth");
      });

      it("should use default URL when envURL is not set", async () => {
        delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

        vi.resetModules();
        await import("@/lib/features/authentication/client");

        expect(capturedConfig?.baseURL).toBe("https://api.wxyc.org/auth");
      });
    });
  });
});
