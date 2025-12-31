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
  const session = await serverAuthClient.getSession({
    fetchOptions: {
      headers: { cookie: cookieHeader },
    },
  }) as BetterAuthSessionResponse;
  
  return session.data;
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

  // Check if user is incomplete (missing required fields: realName or djName)
  if (isUserIncomplete(session)) {
    // Redirect to /login - the login layout will automatically show the newuser slot
    // because the user is incomplete (detected via betterAuthSessionToAuthenticationData)
    redirect("/login");
  }

  return session;
}

/**
 * Extract user's authorization level from session
 * Gets role from session.user.organization.role or session.user.role, then maps to Authorization enum
 */
function getUserAuthority(session: BetterAuthSession): Authorization {
  // Get role from organization member data (if available) or user role
  // Organization role takes precedence over base user role
  // Also check if role is stored in metadata or other custom fields
  const organizationRole = (session.user as any).organization?.role;
  const userRole = (session.user as any).role;
  // Check for role in metadata or other potential locations
  const metadataRole = (session.user as any).metadata?.role;
  const customRole = (session.user as any).customRole;
  const roleToMap = organizationRole || metadataRole || customRole || userRole;

  const authority = mapRoleToAuthorization(roleToMap);
  
  return authority;
}

/**
 * Check if user has the required role (non-redirecting)
 * Returns true if user has sufficient permissions
 */
export function checkRole(session: BetterAuthSession, requiredRole: Authorization): boolean {
  const userAuthority = getUserAuthority(session);
  
  // Role hierarchy: SM > MD > DJ > NO
  // User must have at least the required role
  return userAuthority >= requiredRole;
}

/**
 * Require a specific role - redirects if user doesn't have sufficient permissions
 * Redirects to dashboard home if insufficient permissions
 */
export async function requireRole(session: BetterAuthSession, requiredRole: Authorization): Promise<void> {
  if (!checkRole(session, requiredRole)) {
    redirect(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard"));
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

