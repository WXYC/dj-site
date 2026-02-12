import { jwtDecode } from "jwt-decode";
import {
  AuthenticationData,
  AuthenticatedUser,
  BetterAuthJwtPayload,
  IncompleteUser,
  mapRoleToAuthorization,
  User,
  VerifiedData
} from "./types";
import { getAppOrganizationId, getAppOrganizationIdClient } from "./organization-config";

// Better-auth session type (from better-auth client)
export type BetterAuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
    username?: string;
    emailVerified: boolean;
    realName?: string;
    djName?: string;
    appSkin?: string;
    createdAt?: Date;
    updatedAt?: Date;
    role?: string;  // Base user role (e.g., "user")
    banned?: boolean;
    banReason?: string | null;
    banExpires?: Date | null;
    displayUsername?: string | null;
    image?: string | null;
    // Organization member data (if using organizationClient)
    organization?: {
      id: string;
      name: string;
      role?: string;  // Organization member role (e.g., "member", "dj", "musicDirector", "stationManager")
    };
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token?: string;  // Session ID (not a JWT token)
    activeOrganizationId?: string | null;  // Active organization ID if user is part of an organization
  };
};

// Better-auth session response type (from getSession() call)
export type BetterAuthSessionResponse = {
  data: BetterAuthSession | null;
  error?: {
    message: string;
    code?: string;
  };
};

export const defaultAuthenticationData: AuthenticationData = {
  message: "Not Authenticated",
};


// Convert better-auth JWT token to User
export function toUserFromBetterAuthJWT(token: string): User {
  const decodedToken = jwtDecode<BetterAuthJwtPayload>(token);

  return {
    id: decodedToken.id || decodedToken.sub,
    username: decodedToken.email.split("@")[0] || decodedToken.id || "", // Fallback if username not in token
    email: decodedToken.email,
    authority: mapRoleToAuthorization(decodedToken.role),
  };
}

/**
 * Convert better-auth session to AuthenticationData format (synchronous)
 * Note: This function does not fetch organization role from APP_ORGANIZATION.
 * It only uses role data already present in the session object.
 * For proper role-based access control, use betterAuthSessionToAuthenticationDataAsync() instead.
 */
export function betterAuthSessionToAuthenticationData(
  session: BetterAuthSession | null | undefined
): AuthenticationData {
  if (!session || !session.user) {
    return { message: "Not Authenticated" };
  }

  // Get role from organization member data (preferred) or user role
  /* eslint-disable @typescript-eslint/no-explicit-any -- better-auth SDK session type may include extra fields at runtime */
  const organizationRole = (session.user as any).organization?.role;
  const userRole = (session.user as any).role;
  const metadataRole = (session.user as any).metadata?.role;
  const customRole = (session.user as any).customRole;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const roleToMap = organizationRole || metadataRole || customRole || userRole;

  const token = session.session?.token;
  const authority = mapRoleToAuthorization(roleToMap);

  const username = session.user.username || session.user.name;
  
  // Check if user is incomplete (missing required fields: realName or djName)
  const missingAttributes: (keyof VerifiedData)[] = [];
  if (!session.user.realName || session.user.realName.trim() === "") {
    missingAttributes.push("realName");
  }
  if (!session.user.djName || session.user.djName.trim() === "") {
    missingAttributes.push("djName");
  }

  // If user is missing required fields, return IncompleteUser
  if (missingAttributes.length > 0) {
    return {
      username,
      requiredAttributes: missingAttributes,
    } as IncompleteUser;
  }

  const user: User = {
    id: session.user.id,
    username: username,
    email: session.user.email,
    realName: session.user.realName,
    djName: session.user.djName,
    authority: authority,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
    appSkin: session.user.appSkin,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };

  return {
    user,
    accessToken: token,
    token: token, // Session ID (not a JWT)
  } as AuthenticatedUser;
}

/**
 * Convert better-auth session to AuthenticationData format (async)
 * Fetches the user's role from APP_ORGANIZATION organization for proper role-based access control.
 * Falls back to session-based role extraction if organization query fails.
 */
export async function betterAuthSessionToAuthenticationDataAsync(
  session: BetterAuthSession | null | undefined
): Promise<AuthenticationData> {
  if (!session || !session.user) {
    return { message: "Not Authenticated" };
  }

  let roleToMap: string | undefined;
  
  // Try to get role from APP_ORGANIZATION first
  // Use client-safe function that checks NEXT_PUBLIC_APP_ORGANIZATION first, then server-side APP_ORGANIZATION
  const organizationId = typeof window !== "undefined" 
    ? getAppOrganizationIdClient()
    : getAppOrganizationId();

  if (organizationId && typeof window !== "undefined") {
    try {
      // Client-side only: dynamically import to avoid server-side import issues
      // The client function uses authClient which is marked "use client" and can't be imported on server
      const { getUserRoleInOrganizationClient } = await import("./organization-utils");
      const orgRole = await getUserRoleInOrganizationClient(session.user.id, organizationId);
      
      if (orgRole !== undefined) {
        roleToMap = orgRole;
      }
    } catch (error) {
      // If organization query fails, fall back to session-based role extraction
      console.warn("Failed to fetch organization role, falling back to session data:", error);
    }
  }
  // On server-side, skip organization role fetch here - server-side code should use
  // betterAuthSessionToAuthenticationData with getUserRoleInOrganization separately (as in session.ts)
  
  // Fallback: Get role from session data if not already set
  if (!roleToMap) {
    /* eslint-disable @typescript-eslint/no-explicit-any -- better-auth SDK session type may include extra fields at runtime */
    const organizationRole = (session.user as any).organization?.role;
    const userRole = (session.user as any).role;
    const metadataRole = (session.user as any).metadata?.role;
    const customRole = (session.user as any).customRole;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    roleToMap = organizationRole || metadataRole || customRole || userRole;
  }

  const token = session.session?.token;
  const authority = mapRoleToAuthorization(roleToMap);

  const username = session.user.username || session.user.name;
  
  // Check if user is incomplete (missing required fields: realName or djName)
  const missingAttributes: (keyof VerifiedData)[] = [];
  if (!session.user.realName || session.user.realName.trim() === "") {
    missingAttributes.push("realName");
  }
  if (!session.user.djName || session.user.djName.trim() === "") {
    missingAttributes.push("djName");
  }

  // If user is missing required fields, return IncompleteUser
  if (missingAttributes.length > 0) {
    return {
      username,
      requiredAttributes: missingAttributes,
    } as IncompleteUser;
  }

  const user: User = {
    id: session.user.id,
    username: username,
    email: session.user.email,
    realName: session.user.realName,
    djName: session.user.djName,
    authority: authority,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
    appSkin: session.user.appSkin,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };

  return {
    user,
    accessToken: token,
    token: token, // Session ID (not a JWT)
  } as AuthenticatedUser;
}
