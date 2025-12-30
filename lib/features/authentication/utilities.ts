import { jwtDecode } from "jwt-decode";
import { Authorization } from "../admin/types";
import { 
  AuthenticationData, 
  AuthenticatedUser,
  BetterAuthJwtPayload,
  mapRoleToAuthorization,
  User
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

// Convert better-auth session to AuthenticationData format
export function betterAuthSessionToAuthenticationData(
  session: BetterAuthSession | null | undefined
): AuthenticationData {
  if (!session || !session.user) {
    return { message: "Not Authenticated" };
  }

  // Get role from organization member data (preferred) or user role
  const organizationRole = (session.user as any).organization?.role;
  const userRole = (session.user as any).role;
  const metadataRole = (session.user as any).metadata?.role;
  const customRole = (session.user as any).customRole;
  const roleToMap = organizationRole || metadataRole || customRole || userRole;

  const token = session.session?.token;
  const authority = mapRoleToAuthorization(roleToMap);

  const user: User = {
    id: session.user.id,
    username: session.user.username || session.user.name,
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
