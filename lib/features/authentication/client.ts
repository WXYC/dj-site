"use client";

import { createAuthClient } from "better-auth/react"
import { adminClient, usernameClient, jwtClient, organizationClient } from "better-auth/client/plugins"

// Client-side only - contains React hooks
// This file should only be imported in client components

// NEXT_PUBLIC_ variables are available at build time in Next.js
function getBaseURL(): string {
  // Client-side: prefer same-origin proxy to ensure session cookies are set
  const envURL = process?.env?.NEXT_PUBLIC_BETTER_AUTH_URL;

  if (typeof window !== "undefined") {
    if (envURL) {
      try {
        const url = new URL(envURL);
        if (url.origin !== window.location.origin) {
          return `${window.location.origin}/auth`;
        }
        return envURL;
      } catch {
        // If envURL isn't a valid absolute URL, treat it as a path
        return envURL.startsWith("/")
          ? `${window.location.origin}${envURL}`
          : `${window.location.origin}/auth`;
      }
    }

    return `${window.location.origin}/auth`;
  }

  return envURL || "https://api.wxyc.org/auth";
}

const baseURL = getBaseURL();

const baseConfig = {
    baseURL,
    fetchOptions: {
        credentials: "include" as RequestCredentials,
    },
    plugins: [
        adminClient(),
        usernameClient(),
        jwtClient(),
        organizationClient(),
    ]
};

// Client-side auth client (for React components)
export const authClient = createAuthClient(baseConfig);

let cachedToken: string | null = null;
let cacheExpiry = 0;
let inflight: Promise<string | null> | null = null;
const TOKEN_CACHE_MS = 4 * 60 * 1000;

async function fetchJWTToken(): Promise<string | null> {
  try {
    const response = await fetch(`${baseURL}/token`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.token || null;
  } catch (error) {
    console.error("Failed to get JWT token:", error);
    return null;
  }
}

/**
 * Get JWT token from better-auth /token endpoint.
 * Caches the token for 4 minutes and deduplicates concurrent requests.
 */
export async function getJWTToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cacheExpiry) {
    return cachedToken;
  }

  if (inflight) {
    return inflight;
  }

  inflight = fetchJWTToken().then((token) => {
    cachedToken = token;
    cacheExpiry = token ? Date.now() + TOKEN_CACHE_MS : 0;
    inflight = null;
    return token;
  });

  return inflight;
}

export function clearTokenCache(): void {
  cachedToken = null;
  cacheExpiry = 0;
  inflight = null;
}