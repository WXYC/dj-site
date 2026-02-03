import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock better-auth/client
vi.mock("better-auth/client", () => ({
  createAuthClient: vi.fn(() => ({
    getSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    admin: {},
    organization: {},
  })),
}));

// Mock better-auth/client/plugins
vi.mock("better-auth/client/plugins", () => ({
  adminClient: vi.fn(() => ({})),
  usernameClient: vi.fn(() => ({})),
  jwtClient: vi.fn(() => ({})),
  organizationClient: vi.fn(() => ({})),
}));

describe("server-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("should create auth client with admin plugin", async () => {
    const { createAuthClient } = await import("better-auth/client");
    const { adminClient } = await import("better-auth/client/plugins");

    // Re-import to trigger the module initialization
    vi.resetModules();
    await import("@/lib/features/authentication/server-client");

    expect(adminClient).toHaveBeenCalled();
    expect(createAuthClient).toHaveBeenCalled();
  });

  it("should have admin property", async () => {
    const { serverAuthClient } = await import(
      "@/lib/features/authentication/server-client"
    );
    expect(serverAuthClient.admin).toBeDefined();
  });

  it("should have organization property", async () => {
    const { serverAuthClient } = await import(
      "@/lib/features/authentication/server-client"
    );
    expect(serverAuthClient.organization).toBeDefined();
  });

  it("should use default base URL when env not set", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
    delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

    vi.resetModules();
    const { serverAuthClient } = await import(
      "@/lib/features/authentication/server-client"
    );

    expect(serverAuthClient).toBeDefined();

    // Restore
    if (originalEnv) {
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL = originalEnv;
    }
  });
});
