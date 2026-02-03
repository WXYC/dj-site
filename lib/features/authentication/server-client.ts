import { createAuthClient } from "better-auth/client"
import { adminClient, usernameClient, jwtClient, organizationClient } from "better-auth/client/plugins"

// Server-side only - no React dependencies
// This file can be safely imported in middleware, server components, and API routes

// NEXT_PUBLIC_ variables are available at build time in Next.js
function getBaseURL(): string {
  // Server-side: access process.env directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return "/auth";
}

const baseURL = getBaseURL();

const baseConfig = {
    baseURL,
    plugins: [
        adminClient(),
        usernameClient(),
        jwtClient(),
        organizationClient(),
    ]
};

// Server-side auth client (for server components, middleware, and API routes)
export const serverAuthClient = createAuthClient(baseConfig);

