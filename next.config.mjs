/** @type {import('next').NextConfig} */
// NOTE: `/auth/*` is NOT proxied here. It used to be a `/auth/:path*` rewrite,
// but on the OpenNext/Cloudflare Workers runtime a rewrite folds multiple
// `Set-Cookie` response headers into one (opennextjs-cloudflare#501), which
// broke better-auth sign-out and trapped stale-cookie profiles in a login loop.
// Proxying now lives in `app/auth/[...path]/route.ts`, which re-emits each
// `Set-Cookie` individually. Do not re-add an `/auth` rewrite here.

// `NEXT_DIST_DIR_SUFFIX` lets parallel builds (different NEXT_PUBLIC_* values
// in particular) coexist by writing to `.next-<suffix>/` instead of the
// default `.next/`. No application semantics — set by scripts that need a
// second build alongside the primary one.
const distDir = process.env.NEXT_DIST_DIR_SUFFIX
  ? `.next-${process.env.NEXT_DIST_DIR_SUFFIX}`
  : ".next";

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
        // MUST MATCH DEFAULT_DASHBOARD_HOME_PAGE in
        // lib/features/application/constants.ts. This file is plain ESM loaded
        // by the Next build and cannot import the TypeScript constant, so the
        // literal is duplicated here under this comment — change both together.
        destination:
          process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

// OpenNext Cloudflare dev initialization
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
