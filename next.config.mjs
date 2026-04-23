/** @type {import('next').NextConfig} */
const authBaseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";

const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: true,
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
        destination: `${authBaseURL}/:path*`,
      },
    ];
  },
};

export default nextConfig;

// OpenNext Cloudflare dev initialization
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
