/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Explicitly set workspace root to silence lockfile warning
  outputFileTracingRoot: import.meta.dirname,
  // Required for OpenNext Cloudflare
  output: "standalone",
};

export default nextConfig;

// OpenNext Cloudflare dev initialization
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
