"use client";
import { adminClient, jwtClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL!,
  plugins: [adminClient(), usernameClient(), jwtClient()],
  fetchOptions: {
    credentials: "include",
    // Add timeout to prevent infinite hangs
    timeout: 10000, // 10 seconds
  },
  user: {
    additionalFields: {
      realName: { type: "string", required: false },
      djName: { type: "string", required: false },
      appSkin: { type: "string", required: true, default: "modern" },
    },
  },
  // Remove invalid signIn/signUp configuration - these are handled by the username plugin
});

export const { signIn, signOut, getSession, getAccessToken } = authClient;
