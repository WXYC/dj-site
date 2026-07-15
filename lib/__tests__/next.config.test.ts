import { afterEach, describe, it, expect, vi } from "vitest";
import { DEFAULT_DASHBOARD_HOME_PAGE } from "@/lib/features/application/constants";

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

  describe("/dashboard redirect fallback (#632)", () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    type Redirect = { source?: string; destination?: string };

    // next.config.mjs is plain ESM and cannot import the TypeScript constant,
    // so it duplicates the literal under a MUST-MATCH comment. This pins the
    // two together: divergence fails CI instead of silently reintroducing the
    // split-fallback bug.
    it("falls back to DEFAULT_DASHBOARD_HOME_PAGE when the env var is unset", async () => {
      process.env = { ...originalEnv };
      delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;

      const config = (await loadConfig()) as {
        redirects?: () => Promise<Redirect[]>;
      };
      const redirects = config.redirects ? await config.redirects() : [];
      const dashboard = redirects.find((r) => r.source === "/dashboard");

      expect(dashboard?.destination).toBe(DEFAULT_DASHBOARD_HOME_PAGE);
    });

    it("prefers NEXT_PUBLIC_DASHBOARD_HOME_PAGE when set", async () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard/flowsheet",
      };

      const config = (await loadConfig()) as {
        redirects?: () => Promise<Redirect[]>;
      };
      const redirects = config.redirects ? await config.redirects() : [];
      const dashboard = redirects.find((r) => r.source === "/dashboard");

      expect(dashboard?.destination).toBe("/dashboard/flowsheet");
    });
  });
});
