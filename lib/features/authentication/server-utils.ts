import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverAuthClient } from "./server-client";
import { BetterAuthSessionResponse, BetterAuthSession } from "./utilities";
import { Authorization } from "../admin/types";
import { mapRoleToAuthorization, VerifiedData } from "./types";

/**
 * Get the current session from better-auth in a server component
 * Returns null if not authenticated
 */
export async function getServerSession(): Promise<BetterAuthSession | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  
  // Use fetchOptions to pass cookies to better-auth client
  const session = await serverAuthClient
    .getSession({
      fetchOptions: {
        headers: { cookie: cookieHeader },
      },
    })
    .catch((error) => {
      // Swallow auth-server fetch errors to avoid noisy Next.js errors.
      return { data: null, error } as BetterAuthSessionResponse;
    });
  
  if (!session.data) {
    return null;
  }

  const normalizedSession = {
    ...session.data,
    user: {
      ...session.data.user,
      username: session.data.user.username ?? undefined,
    },
  } as BetterAuthSession;

  return normalizedSession;
}

/**
 * Require authentication - redirects to login if not authenticated
 * Redirects to onboarding page if user is incomplete (missing required fields)
 * Returns the session if authenticated and complete
 */
export async function requireAuth(): Promise<BetterAuthSession> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  return session;
}

/**
 * Extract user's authorization level from session
 * Uses session.user.role directly (Direct Role Model)
 */
function getUserAuthority(session: BetterAuthSession): Authorization {
  // Get role directly from user.role (Direct Role Model)
  const roleToMap = session.user.role;
  return mapRoleToAuthorization(roleToMap);
}

/**
 * Check if user has the required role (non-redirecting)
 * Returns true if user has sufficient permissions
 */
export function checkRole(session: BetterAuthSession, requiredRole: Authorization): boolean {
  const userAuthority = getUserAuthority(session);
  
  // Role hierarchy: ADMIN > SM > MD > DJ > NO
  // User must have at least the required role
  return userAuthority >= requiredRole;
}

/**
 * Require a specific role - redirects if user doesn't have sufficient permissions
 * Redirects to dashboard home if insufficient permissions
 */
export function requireRole(session: BetterAuthSession, requiredRole: Authorization): void {
  if (!checkRole(session, requiredRole)) {
    redirect(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog"));
  }
}

/**
 * Check if user is incomplete (missing required fields: realName or djName)
 */
export function isUserIncomplete(session: BetterAuthSession): boolean {
  const realName = session.user.realName;
  const djName = session.user.djName;
  
  return !realName || realName.trim() === "" || !djName || djName.trim() === "";
}

/**
 * Get array of missing required attributes for incomplete user
 */
export function getIncompleteUserAttributes(session: BetterAuthSession): (keyof VerifiedData)[] {
  const missingAttributes: (keyof VerifiedData)[] = [];
  
  if (!session.user.realName || session.user.realName.trim() === "") {
    missingAttributes.push("realName");
  }
  
  if (!session.user.djName || session.user.djName.trim() === "") {
    missingAttributes.push("djName");
  }
  
  return missingAttributes;
}

/**
 * Get user object from session (for compatibility with existing code)
 */
export function getUserFromSession(session: BetterAuthSession) {
  const token = session.session?.token;
  const userAuthority = getUserAuthority(session);

  const result = {
    id: session.user.id,
    username: session.user.username || session.user.name,
    email: session.user.email,
    realName: session.user.realName || undefined, // Convert null to undefined for cleaner handling
    djName: session.user.djName || undefined,
    authority: userAuthority,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
    appSkin: session.user.appSkin,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };

  return result;
}

