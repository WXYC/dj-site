import { createAuthClient } from "better-auth/client"
import { adminClient, emailOTPClient, usernameClient, jwtClient, organizationClient } from "better-auth/client/plugins"

// Server-side only - no React dependencies
// This file can be safely imported in middleware, server components, and API routes

export function getServerAuthBaseURL(): string {
  // AUTH_REWRITE_URL is a server-only override for setups where the auth
  // service is reachable from the host (NEXT_PUBLIC_BETTER_AUTH_URL) but not
  // from inside the dj-site server (e.g. docker compose, where the host's
  // localhost is the container itself). Precedence must match the
  // /auth/:path* rewrite in next.config.mjs.
  return (
    process.env.AUTH_REWRITE_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    "https://api.wxyc.org/auth"
  );
}

const baseURL = getServerAuthBaseURL();

const baseConfig = {
    baseURL,
    plugins: [
        adminClient(),
        emailOTPClient(),
        usernameClient(),
        jwtClient(),
        organizationClient(),
    ]
};

export const serverAuthClient = createAuthClient(baseConfig);
