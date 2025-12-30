"use client";

import { createAuthClient } from "better-auth/react"
import { adminClient, usernameClient, jwtClient, organizationClient } from "better-auth/client/plugins"

// Client-side only - contains React hooks
// This file should only be imported in client components

// NEXT_PUBLIC_ variables are available at build time in Next.js
function getBaseURL(): string {
  // Client-side: NEXT_PUBLIC_ variables are injected at build time
  return (globalThis as typeof globalThis & { process?: { env?: { NEXT_PUBLIC_BETTER_AUTH_URL?: string } } })
    .process?.env?.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:8082/api/auth";
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