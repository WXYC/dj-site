"use client";

import { createAuthClient } from "better-auth/react"
import { adminClient, usernameClient, jwtClient } from "better-auth/client/plugins"

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
    ]
};

// Client-side auth client (for React components)
export const authClient = createAuthClient(baseConfig);

/**
 * Get JWT token from better-auth /token endpoint
 * Use this for API calls that require authentication
 */
export async function getJWTToken(): Promise<string | null> {
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