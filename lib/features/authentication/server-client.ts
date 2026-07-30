import "server-only";
import { createAuthClient } from "better-auth/client"
import { adminClient, emailOTPClient, usernameClient, jwtClient, organizationClient } from "better-auth/client/plugins"
import { authFetchWithBase, type AuthFetchInit, type AuthResult } from "./auth-fetch"

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

/**
 * Typed gateway for server-side auth-service requests. Resolves the path
 * against the server auth base URL (which honors the AUTH_REWRITE_URL
 * override). Callers supply their own `cookie` header rather than relying on
 * ambient credentials.
 */
export function serverAuthFetch<T = unknown>(
  path: string,
  init: AuthFetchInit = {},
): Promise<AuthResult<T>> {
  return authFetchWithBase<T>(getServerAuthBaseURL(), path, init);
}

/**
 * Mint a Backend-Service bearer JWT server-side by forwarding the caller's
 * session cookie to the auth service's `/token` endpoint. This is the
 * server-side counterpart to the client's `getJWTToken`: the browser session
 * cookie is scoped to the dj-site origin, not to Backend-Service, so an
 * authenticated server-side BS call must exchange the cookie for a JWT here
 * rather than forward the cookie directly. Returns null on any failure (no
 * cookie, auth error, unparseable body) so callers fail closed.
 */
export async function getServerJwtToken(
  cookieHeader?: string,
): Promise<string | null> {
  try {
    const { ok, data } = await serverAuthFetch<{ token?: unknown }>("/token", {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (!ok) {
      return null;
    }
    return typeof data?.token === "string" ? data.token : null;
  } catch {
    return null;
  }
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
