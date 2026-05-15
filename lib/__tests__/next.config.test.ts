import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  initOpenNextCloudflareForDev: vi.fn(),
}));

async function loadConfig() {
  vi.resetModules();
  const mod = await import("../../next.config.mjs");
  return mod.default;
}

describe("next.config rewrites", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_REWRITE_URL;
    delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("targets AUTH_REWRITE_URL when set, overriding NEXT_PUBLIC_BETTER_AUTH_URL", async () => {
    process.env.AUTH_REWRITE_URL = "http://auth:8082/auth";
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "http://localhost:8082/auth";

    const config = await loadConfig();
    const rewrites = await config.rewrites();

    expect(rewrites).toContainEqual({
      source: "/auth/:path*",
      destination: "http://auth:8082/auth/:path*",
    });
  });

  it("falls back to NEXT_PUBLIC_BETTER_AUTH_URL when AUTH_REWRITE_URL is unset", async () => {
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "http://localhost:8082/auth";

    const config = await loadConfig();
    const rewrites = await config.rewrites();

    expect(rewrites).toContainEqual({
      source: "/auth/:path*",
      destination: "http://localhost:8082/auth/:path*",
    });
  });

  it("falls back to the production default when neither env var is set", async () => {
    const config = await loadConfig();
    const rewrites = await config.rewrites();

    expect(rewrites).toContainEqual({
      source: "/auth/:path*",
      destination: "https://api.wxyc.org/auth/:path*",
    });
  });
});
