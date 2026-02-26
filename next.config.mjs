/** @type {import('next').NextConfig} */
const authBaseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";

const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: true,
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

export default nextConfig;

// OpenNext Cloudflare dev initialization
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
