import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock better-auth/react
vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({
    useSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock better-auth/client/plugins
vi.mock("better-auth/client/plugins", () => ({
  adminClient: vi.fn(() => ({})),
  usernameClient: vi.fn(() => ({})),
  jwtClient: vi.fn(() => ({})),
  organizationClient: vi.fn(() => ({})),
}));

describe("authentication client", () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
  });

  describe("authClient", () => {
    it("should export authClient", async () => {
      const { authClient } = await import(
        "@/lib/features/authentication/client"
      );
      expect(authClient).toBeDefined();
    });
  });
});
