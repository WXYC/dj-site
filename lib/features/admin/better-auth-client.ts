import { cookies } from "next/headers";
import { serverAuthClient } from "../authentication/server-client";
import { Authorization } from "./types";
import { isAuthenticated } from "../authentication/types";
import { betterAuthSessionToAuthenticationData as convertSession, BetterAuthSessionResponse } from "../authentication/utilities";

/**
 * Verifies that the current user is authenticated and has admin (stationManager) privileges
 * @throws Error if user is not authenticated or not an admin
 */
export async function verifyAdminAccess(): Promise<void> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const session = await serverAuthClient.getSession({
    fetchOptions: {
      headers: {
        cookie: cookieHeader,
      },
    },
  }) as BetterAuthSessionResponse;

  if (!session.data) {
    throw new Error("User is not authenticated");
  }

  const authData = convertSession(session.data);
  
  if (!isAuthenticated(authData)) {
    throw new Error("User is not authenticated");
  }

  if (authData.user?.authority !== Authorization.SM) {
    throw new Error("User does not have admin privileges");
  }
}

/**
 * Gets the better-auth admin client for making admin API calls
 * Verifies admin access before returning
 */
export async function getBetterAuthAdminClient() {
  await verifyAdminAccess();
  return serverAuthClient;
}

