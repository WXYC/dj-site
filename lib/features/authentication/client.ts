"use client";
import { adminClient, jwtClient, usernameClient, organizationClient as organizationPlugin } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL!,
  plugins: [adminClient(), usernameClient(), jwtClient(), organizationPlugin()],
  fetchOptions: {
    credentials: "include",
    // Add timeout to prevent infinite hangs
    timeout: 10000, // 10 seconds
  },
  username: { enabled: true },
  user: {
    additionalFields: {
      realName: { type: "string", required: false },
      djName: { type: "string", required: false },
      onboarded: { type: "boolean", required: true, default: false },
      appSkin: { type: "string", required: true, default: "modern-light" },
      role: { type: "string", required: false, default: "dj" },
    },
  },
  // Remove invalid signIn/signUp configuration - these are handled by the username plugin
});

export const { 
  signIn, 
  signOut, 
  getSession, 
  getAccessToken,
  organization
} = authClient;

// Export organization functions - these will be properly typed when better-auth is fully configured
export const organizationClient = organization;
