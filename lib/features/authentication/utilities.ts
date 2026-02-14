import { jwtDecode } from "jwt-decode";
import { Authorization } from "../admin/types";
import {
  AuthenticationData,
  AuthenticatedUser,
  BetterAuthJwtPayload,
  IncompleteUser,
  mapRoleToAuthorization,
  User,
  VerifiedData,
  WXYCRole
} from "./types";

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
    role?: string;  // User role (e.g., "member", "dj", "musicDirector", "stationManager")
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
 * Convert better-auth session to AuthenticationData format
 * Gets role directly from session.user.role
 */
export function betterAuthSessionToAuthenticationData(
  session: BetterAuthSession | null | undefined
): AuthenticationData {
  if (!session || !session.user) {
    return { message: "Not Authenticated" };
  }

  // Get role directly from user record
  const role = session.user.role as WXYCRole | undefined;
  const token = session.session?.token;
  const authority = mapRoleToAuthorization(role);

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
    token: token,
  } as AuthenticatedUser;
}

