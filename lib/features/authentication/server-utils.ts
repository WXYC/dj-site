import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverAuthClient } from "./server-client";
import { BetterAuthSessionResponse, BetterAuthSession } from "./utilities";
import { Authorization } from "../admin/types";
import { mapRoleToAuthorization, VerifiedData } from "./types";
import { getUserRoleInOrganization, getAppOrganizationId } from "./organization-utils";

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
 * Fetches role from APP_ORGANIZATION organization first, then falls back to session data
 * Gets role from organization query, session.user.organization.role, or session.user.role, then maps to Authorization enum
 */
async function getUserAuthority(session: BetterAuthSession, cookieHeader?: string): Promise<Authorization> {
  // Try to get role from APP_ORGANIZATION first
  const organizationId = getAppOrganizationId();
  
  if (organizationId) {
    try {
      const orgRole = await getUserRoleInOrganization(
        session.user.id,
        organizationId,
        cookieHeader
      );
      
      if (orgRole !== undefined) {
        // Successfully fetched role from organization
        return mapRoleToAuthorization(orgRole);
      }
      // If user is not a member, continue to fallback logic (will return NO access)
    } catch (error) {
      // If organization query fails, fall back to session-based role extraction
      console.warn("Failed to fetch organization role, falling back to session data:", error);
    }
  }
  
  // Fallback: Get role from session data (organization member data if available, or user role)
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
export async function checkRole(session: BetterAuthSession, requiredRole: Authorization, cookieHeader?: string): Promise<boolean> {
  const userAuthority = await getUserAuthority(session, cookieHeader);
  
  // Role hierarchy: SM > MD > DJ > NO
  // User must have at least the required role
  return userAuthority >= requiredRole;
}

/**
 * Require a specific role - redirects if user doesn't have sufficient permissions
 * Redirects to dashboard home if insufficient permissions
 */
export async function requireRole(session: BetterAuthSession, requiredRole: Authorization, cookieHeader?: string): Promise<void> {
  const cookieStore = await cookies();
  const header = cookieHeader || cookieStore.toString();
  
  if (!(await checkRole(session, requiredRole, header))) {
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
export async function getUserFromSession(session: BetterAuthSession, cookieHeader?: string) {
  const token = session.session?.token;
  const cookieStore = await cookies();
  const header = cookieHeader || cookieStore.toString();
  const userAuthority = await getUserAuthority(session, header);

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

