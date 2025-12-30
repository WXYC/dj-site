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
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token?: string;  // JWT token if using jwtClient plugin
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
    // Additional fields would need to be fetched from session/user object
  };
}

// Convert better-auth session to AuthenticationData format
export function betterAuthSessionToAuthenticationData(
  session: BetterAuthSession | null | undefined
): AuthenticationData {
  if (!session || !session.user) {
    return { message: "Not Authenticated" };
  }

  const token = session.session?.token;
  let user: User | undefined;

  if (token) {
    // Decode JWT to get role and other claims
    try {
      const decodedToken = jwtDecode<BetterAuthJwtPayload>(token);
      user = {
        id: session.user.id,
        username: session.user.username || session.user.name,
        email: session.user.email,
        realName: session.user.realName,
        djName: session.user.djName,
        authority: mapRoleToAuthorization(decodedToken.role),
        name: session.user.name,
        emailVerified: session.user.emailVerified,
        appSkin: session.user.appSkin,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      };
    } catch (error) {
      // If JWT decode fails, create user without role (will default to NO)
      user = {
        id: session.user.id,
        username: session.user.username || session.user.name,
        email: session.user.email,
        realName: session.user.realName,
        djName: session.user.djName,
        authority: Authorization.NO, // Default if can't decode
        name: session.user.name,
        emailVerified: session.user.emailVerified,
        appSkin: session.user.appSkin,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      };
    }
  } else {
    // No token, create basic user object
    user = {
      id: session.user.id,
      username: session.user.username || session.user.name,
      email: session.user.email,
      realName: session.user.realName,
      djName: session.user.djName,
      authority: Authorization.NO, // Default if no token
      name: session.user.name,
      emailVerified: session.user.emailVerified,
      appSkin: session.user.appSkin,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    };
  }

  return {
    user,
    accessToken: token,
    token: token, // Better-auth uses 'token' field
  } as AuthenticatedUser;
}
