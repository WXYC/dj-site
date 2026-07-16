import { Authorization } from "../admin/types";
import {
  AuthenticationData,
  AuthenticatedUser,
  IncompleteUser,
  roleToAuthorization,
  User,
  VerifiedData
} from "./types";
import { getAppOrganizationId, getAppOrganizationIdClient } from "./organization-config";

export type BetterAuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
    username?: string;
    emailVerified: boolean;
    realName?: string;
    djName?: string;
    pronouns?: string;
    namePronunciation?: string;
    showTimes?: string;
    title?: string;
    semesterHired?: string;
    bio?: string;
    location?: string;
    appSkin?: string;
    createdAt?: Date;
    updatedAt?: Date;
    role?: string;  // Base user role (e.g., "user")
    banned?: boolean;
    banReason?: string | null;
    banExpires?: Date | null;
    hasCompletedOnboarding?: boolean;
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
    activeOrganizationId?: string | null;
  };
};

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


/**
 * This function does not fetch organization role from APP_ORGANIZATION.
 * It only uses role data already present in the session object.
 * For proper role-based access control, use betterAuthSessionToAuthenticationDataAsync() instead.
 */
export function betterAuthSessionToAuthenticationData(
  session: BetterAuthSession | null | undefined
): AuthenticationData {
  if (!session || !session.user) {
    return { message: "Not Authenticated" };
  }

  const organizationRole = (session.user as any).organization?.role;
  const userRole = (session.user as any).role;
  const metadataRole = (session.user as any).metadata?.role;
  const customRole = (session.user as any).customRole;
  const roleToMap = organizationRole || metadataRole || customRole || userRole;

  const token = session.session?.token;
  const authority = roleToAuthorization(roleToMap);

  const username = session.user.username || session.user.name;

  // Treat undefined/absent as incomplete (`!== true`), matching server-utils.
  if (session.user.hasCompletedOnboarding !== true) {
    const missingAttributes: (keyof VerifiedData)[] = [];
    if (!session.user.realName || session.user.realName.trim() === "") {
      missingAttributes.push("realName");
    }
    // djName is optional — not included in required attributes
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
    pronouns: session.user.pronouns,
    namePronunciation: session.user.namePronunciation,
    showTimes: session.user.showTimes,
    title: session.user.title,
    semesterHired: session.user.semesterHired,
    bio: session.user.bio,
    location: session.user.location,
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

  const organizationId = typeof window !== "undefined"
    ? getAppOrganizationIdClient()
    : getAppOrganizationId();

  if (organizationId && typeof window !== "undefined") {
    try {
      const { fetchOrganizationRoleForUserClient } = await import("./organization-utils");
      const orgRole = await fetchOrganizationRoleForUserClient(
        session.user.id,
        organizationId
      );

      if (orgRole !== undefined) {
        roleToMap = orgRole;
      }
    } catch (error) {
      console.warn("Failed to fetch organization role, falling back to session data:", error);
    }
  }
  // On server-side, skip organization role fetch here - server-side code should use
  // betterAuthSessionToAuthenticationData with getUserRoleInOrganization separately (as in session.ts)

  if (!roleToMap) {
    const organizationRole = (session.user as any).organization?.role;
    const userRole = (session.user as any).role;
    const metadataRole = (session.user as any).metadata?.role;
    const customRole = (session.user as any).customRole;
    roleToMap = organizationRole || metadataRole || customRole || userRole;
  }

  const token = session.session?.token;
  const authority = roleToAuthorization(roleToMap);

  const username = session.user.username || session.user.name;

  // Treat undefined/absent as incomplete (`!== true`), matching server-utils.
  if (session.user.hasCompletedOnboarding !== true) {
    const missingAttributes: (keyof VerifiedData)[] = [];
    if (!session.user.realName || session.user.realName.trim() === "") {
      missingAttributes.push("realName");
    }
    // djName is optional — not included in required attributes
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
    pronouns: session.user.pronouns,
    namePronunciation: session.user.namePronunciation,
    showTimes: session.user.showTimes,
    title: session.user.title,
    semesterHired: session.user.semesterHired,
    bio: session.user.bio,
    location: session.user.location,
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
