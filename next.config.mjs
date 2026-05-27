/** @type {import('next').NextConfig} */
// AUTH_REWRITE_URL is the server-only override the `/auth/:path*` rewrite proxies to.
// Set it when the auth service is reachable from the host but not at the public URL from
// inside the dj-site server (e.g. docker compose, where the host's localhost is the
// container itself). NEXT_PUBLIC_BETTER_AUTH_URL stays the browser-facing URL and is
// the fallback for environments without a split (e.g. Cloudflare Pages production).
const authRewriteURL =
  process.env.AUTH_REWRITE_URL ||
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
  "https://api.wxyc.org/auth";

// E2E-only second-build variant: when NEXT_BUILD_VARIANT=broken-auth, writes
// to a separate build dir so the primary `.next/` cache survives. Used by
// the server-session-via-docker E2E test to exercise the AUTH_REWRITE_URL
// precedence path against an intentionally-unreachable NEXT_PUBLIC_BETTER_AUTH_URL.
const distDir = process.env.NEXT_BUILD_VARIANT === "broken-auth" ? ".next-broken-auth" : ".next";

const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: true,
  distDir,
  // Explicitly set workspace root to silence lockfile warning
  outputFileTracingRoot: import.meta.dirname,
  // Required for OpenNext Cloudflare
  output: "standalone",
  async redirects() {
    return [
      {
        // The dashboard layout uses parallel routes and doesn't render the
        // children slot, so app/dashboard/page.tsx's redirect() never fires.
        // Handle it here instead.
        source: "/dashboard",
        destination:
          process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/flowsheet",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/auth/:path*",
        destination: `${authRewriteURL}/:path*`,
      },
    ];
  },
};

export default nextConfig;

// OpenNext Cloudflare dev initialization
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
