import { withSentryConfig } from "@sentry/nextjs";
/** @type {import('next').NextConfig} */
const authBaseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";

const nextConfig = {
  reactStrictMode: false,
  // Explicitly set workspace root to silence lockfile warning
  outputFileTracingRoot: import.meta.dirname,
  // Required for OpenNext Cloudflare
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/auth/:path*",
        destination: `${authBaseURL}/:path*`,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "wxyc",
  project: "dj-site",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",
});

// OpenNext Cloudflare dev initialization
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
