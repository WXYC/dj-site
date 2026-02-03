import { createAuthClient } from "better-auth/client"
import { adminClient, usernameClient, jwtClient } from "better-auth/client/plugins"
import { headers } from "next/headers";

// Server-side only - no React dependencies
// This file can be safely imported in middleware, server components, and API routes

// NEXT_PUBLIC_ variables are available at build time in Next.js
async function getBaseURL(): Promise<string> {
  // Try to get the host from request headers to use same-origin proxy
  try {
    const headersList = await headers();
    const host = headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") || "https";
    
    if (host) {
      return `${proto}://${host}/auth`;
    }
  } catch {
    // headers() not available (e.g., during build)
  }
  
  // Fallback to env var or default
  return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";
}

const baseURL = await getBaseURL();

const baseConfig = {
    baseURL,
    plugins: [
        adminClient(),
        usernameClient(),
        jwtClient(),
    ]
};

// Server-side auth client (for server components, middleware, and API routes)
export const serverAuthClient = createAuthClient(baseConfig);

