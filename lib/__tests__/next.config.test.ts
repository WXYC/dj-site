import { describe, it, expect, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  initOpenNextCloudflareForDev: vi.fn(),
}));

async function loadConfig() {
  vi.resetModules();
  const mod = await import("../../next.config.mjs");
  return mod.default;
}

type Rewrite = { source?: string };
type RewritesResult =
  | Rewrite[]
  | { beforeFiles?: Rewrite[]; afterFiles?: Rewrite[]; fallback?: Rewrite[] };

// rewrites() may return the array form OR the object form
// ({ beforeFiles, afterFiles, fallback }); flatten both so a re-added `/auth`
// rewrite can't hide in a phase bucket.
function hasAuthRewrite(rewrites: RewritesResult | undefined): boolean {
  const list: Rewrite[] = Array.isArray(rewrites)
    ? rewrites
    : [
        ...(rewrites?.beforeFiles ?? []),
        ...(rewrites?.afterFiles ?? []),
        ...(rewrites?.fallback ?? []),
      ];
  return list.some(
    (r) => typeof r?.source === "string" && r.source.startsWith("/auth"),
  );
}

describe("next.config", () => {
  // Regression guard: `/auth/*` must be proxied by app/auth/[...path]/route.ts,
  // NOT by a config rewrite. On OpenNext/Cloudflare a rewrite folds multiple
  // Set-Cookie response headers into one (opennextjs-cloudflare#501), which
  // breaks better-auth sign-out and re-login. Env resolution for the auth
  // service base URL is covered in app/auth/[...path]/__tests__/route.test.ts.
  it("does not define an /auth rewrite", async () => {
    const config = (await loadConfig()) as {
      rewrites?: () => Promise<RewritesResult>;
    };
    const rewrites = config.rewrites ? await config.rewrites() : undefined;
    expect(hasAuthRewrite(rewrites)).toBe(false);
  });

  it("detects a re-added /auth rewrite in the array form", () => {
    expect(hasAuthRewrite([{ source: "/auth/:path*" }])).toBe(true);
  });

  it("detects a re-added /auth rewrite hidden in any object-form phase bucket", () => {
    expect(hasAuthRewrite({ beforeFiles: [{ source: "/auth/:path*" }] })).toBe(
      true,
    );
    expect(hasAuthRewrite({ afterFiles: [{ source: "/auth/:path*" }] })).toBe(
      true,
    );
    expect(hasAuthRewrite({ fallback: [{ source: "/auth/:path*" }] })).toBe(
      true,
    );
  });

  it("ignores non-/auth rewrites in both forms", () => {
    expect(hasAuthRewrite([{ source: "/api/:path*" }])).toBe(false);
    expect(hasAuthRewrite({ beforeFiles: [{ source: "/api/:path*" }] })).toBe(
      false,
    );
  });
});
