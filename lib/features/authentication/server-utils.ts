import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverAuthClient } from "./server-client";
import { BetterAuthSessionResponse, BetterAuthSession } from "./utilities";
import { Authorization } from "../admin/types";
import { mapRoleToAuthorization } from "./types";
import { appendFileSync } from "fs";

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
 * Returns the session if authenticated
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
 * Gets role from session.user.organization.role or session.user.role, then maps to Authorization enum
 * 
 * Note: If the role is "user" (default), better-auth might be storing organization roles separately.
 * Organization roles set via admin.setRole() are stored in organization membership, not user.role.
 * For the role to appear here, the user needs to have an active organization or the role needs
 * to be set as a user-level role (not organization role).
 */
function getUserAuthority(session: BetterAuthSession): Authorization {
  // #region agent log
  try{appendFileSync('/mnt/c/Users/Jackson/Desktop/Projects/dj-site/.cursor/debug.log',JSON.stringify({location:'server-utils.ts:44',message:'getUserAuthority entry',data:{hasUser:!!session.user,activeOrganizationId:(session.session as any)?.activeOrganizationId},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'U'})+'\n');}catch(e){}
  // #endregion

  // Get role from organization member data (if available) or user role
  // Organization role takes precedence over base user role
  // Also check if role is stored in metadata or other custom fields
  const organizationRole = (session.user as any).organization?.role;
  const userRole = (session.user as any).role;
  // Check for role in metadata or other potential locations
  const metadataRole = (session.user as any).metadata?.role;
  const customRole = (session.user as any).customRole;
  const roleToMap = organizationRole || metadataRole || customRole || userRole;

  // #region agent log
  try{appendFileSync('/mnt/c/Users/Jackson/Desktop/Projects/dj-site/.cursor/debug.log',JSON.stringify({location:'server-utils.ts:58',message:'getUserAuthority role extraction - all sources',data:{organizationRole:organizationRole,userRole:userRole,metadataRole:metadataRole,customRole:customRole,roleToMap:roleToMap,activeOrganizationId:(session.session as any)?.activeOrganizationId},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'V'})+'\n');}catch(e){}
  // #endregion

  const authority = mapRoleToAuthorization(roleToMap);
  
  // #region agent log
  try{appendFileSync('/mnt/c/Users/Jackson/Desktop/Projects/dj-site/.cursor/debug.log',JSON.stringify({location:'server-utils.ts:62',message:'getUserAuthority mapped result',data:{roleToMap:roleToMap,authority:authority},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'W'})+'\n');}catch(e){}
  // #endregion

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
 * Get user object from session (for compatibility with existing code)
 * Note: realName and djName may be null if not set in better-auth user data.
 * These fields can be fetched from the DJ registry API on the client side.
 */
export function getUserFromSession(session: BetterAuthSession) {
  // #region agent log
  try{appendFileSync('/mnt/c/Users/Jackson/Desktop/Projects/dj-site/.cursor/debug.log',JSON.stringify({location:'server-utils.ts:92',message:'getUserFromSession entry - full session structure',data:{fullSession:session,sessionUserKeys:Object.keys(session.user),hasOrganization:!!session.user.organization,organizationData:session.user.organization},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'P'})+'\n');}catch(e){}
  // #endregion

  const token = session.session?.token;
  const userAuthority = getUserAuthority(session);

  // #region agent log
  try{appendFileSync('/mnt/c/Users/Jackson/Desktop/Projects/dj-site/.cursor/debug.log',JSON.stringify({location:'server-utils.ts:98',message:'getUserAuthority result',data:{userAuthority:userAuthority},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'Q'})+'\n');}catch(e){}
  // #endregion

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

  // #region agent log
  try{appendFileSync('/mnt/c/Users/Jackson/Desktop/Projects/dj-site/.cursor/debug.log',JSON.stringify({location:'server-utils.ts:112',message:'getUserFromSession result - missing fields check',data:{result:result,realNameIsNull:result.realName===null||result.realName===undefined,djNameIsNull:result.djName===null||result.djName===undefined,authorityValue:result.authority},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'R'})+'\n');}catch(e){}
  // #endregion

  return result;
}

