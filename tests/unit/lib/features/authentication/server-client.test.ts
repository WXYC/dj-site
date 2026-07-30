import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

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
  emailOTPClient: vi.fn(() => ({ name: "emailOTP" })),
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
          { name: "emailOTP" },
          { name: "username" },
          { name: "jwt" },
          { name: "organization" },
        ],
      });
      expect(capturedConfig.baseURL).toBeDefined();
    });
  });

  describe("getServerAuthBaseURL function behavior", () => {
    it("should use env var when NEXT_PUBLIC_BETTER_AUTH_URL is set", async () => {
      process.env = { ...originalEnv, NEXT_PUBLIC_BETTER_AUTH_URL: "https://custom.example.com/auth" };

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("https://custom.example.com/auth");
    });

    it("should prefer AUTH_REWRITE_URL over NEXT_PUBLIC_BETTER_AUTH_URL", async () => {
      process.env = {
        ...originalEnv,
        AUTH_REWRITE_URL: "http://localhost:8084/auth",
        NEXT_PUBLIC_BETTER_AUTH_URL: "https://custom.example.com/auth",
      };

      vi.resetModules();
      const mod = await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("http://localhost:8084/auth");
      expect(mod.getServerAuthBaseURL()).toBe("http://localhost:8084/auth");
    });

    it("should use default URL when env var is not set", async () => {
      process.env = { ...originalEnv };
      delete process.env.AUTH_REWRITE_URL;
      delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

      vi.resetModules();
      await import("@/lib/features/authentication/server-client");

      expect(capturedConfig?.baseURL).toBe("https://api.wxyc.org/auth");
    });
  });
});

describe("getServerJwtToken", () => {
  const originalEnv = process.env;
  const realFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_BETTER_AUTH_URL: "https://api.wxyc.org/auth" };
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = realFetch;
  });

  async function importFresh() {
    vi.resetModules();
    return import("@/lib/features/authentication/server-client");
  }

  it("mints a token and forwards the session cookie to /token", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ token: "jwt-abc" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { getServerJwtToken } = await importFresh();
    await expect(getServerJwtToken("session=xyz")).resolves.toBe("jwt-abc");

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe("https://api.wxyc.org/auth/token");
    expect(new Headers(init.headers).get("cookie")).toBe("session=xyz");
  });

  it("returns null on a non-ok response", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 401 }));

    const { getServerJwtToken } = await importFresh();
    await expect(getServerJwtToken("session=xyz")).resolves.toBeNull();
  });

  it("returns null when the token field is not a string", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ token: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { getServerJwtToken } = await importFresh();
    await expect(getServerJwtToken("session=xyz")).resolves.toBeNull();
  });

  it("returns null when the fetch rejects", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));

    const { getServerJwtToken } = await importFresh();
    await expect(getServerJwtToken("session=xyz")).resolves.toBeNull();
  });
});
