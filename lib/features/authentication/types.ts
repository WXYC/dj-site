import { JwtPayload } from "jwt-decode";
import { Authorization } from "../admin/types";

export type AuthenticationState = {
  verifications: Verification<VerifiedData>;
  modifications: Verification<ModifiableData>;
  required: (keyof VerifiedData)[];
};

export type AuthenticationData =
  | AuthenticatedUser
  | IncompleteUser
  | PasswordResetUser
  | {
      message: "Not Authenticated";
    };

export type AuthenticatedUser = {
  user?: User;
  accessToken?: string;  // JWT token from better-auth
  token?: string;        // Better-auth JWT token (alternative to accessToken)
};

export function isAuthenticated(
  data: AuthenticationData
): data is AuthenticatedUser {
  return data !== undefined && (data as AuthenticatedUser)?.user !== undefined;
}

export function isIncomplete(data: AuthenticationData): data is IncompleteUser {
  return (
    data !== undefined &&
    (data as IncompleteUser)?.requiredAttributes !== undefined
  );
}

export type IncompleteUser = {
  username: string;
  requiredAttributes: (keyof VerifiedData)[];
};

export function isPasswordReset(
  data: AuthenticationData
): data is PasswordResetUser {
  return (
    data !== undefined &&
    (data as PasswordResetUser)?.username !== undefined &&
    (data as PasswordResetUser)?.confirmationMessage !== undefined
  );
}

export type PasswordResetUser = {
  username: string;
  confirmationMessage: string;
};


export type Credentials = {
  username: string;
  password: string;
};

export type NewUserCredentials = Credentials & Record<string, string>;

export type User = {
  username: string;
  email: string;
  realName?: string;     // Optional: User's real name
  djName?: string;        // Optional: DJ name/on-air name
  authority: Authorization;
  // Better-auth fields (optional for compatibility)
  id?: string;
  name?: string;          // Username (duplicate of username)
  emailVerified?: boolean;
  appSkin?: string;       // UI theme
  createdAt?: Date;
  updatedAt?: Date;
};

export type ResetPasswordCredentials = {
  code: string;
  password: string;
};

export type ResetPasswordRequest = ResetPasswordCredentials & {
  username: string;
};

export type VerifiedData = Omit<User, "authority" | "email"> &
  Credentials &
  ResetPasswordCredentials & {
    confirmPassword: string;
  };

export type ModifiableData = Omit<User, "authority" | "username">;

export type Verification<T> = {
  [K in keyof T]: boolean;
};

export type Validators =
  | "Credentials"
  | "UserData"
  | "ResetPasswordCredentials";


// Better-auth JWT payload structure
export interface BetterAuthJwtPayload extends JwtPayload {
  sub?: string;        // User ID
  id?: string;         // User ID (better-auth may include both)
  email: string;       // User email
  role: WXYCRole;      // Organization member role
  exp: number;         // Expiration timestamp
  iat: number;         // Issued at timestamp
  iss?: string;        // Issuer
  aud?: string;        // Audience
}

// Better-auth role type
export type WXYCRole = "member" | "dj" | "musicDirector" | "stationManager";

export type DJRegistryParams = {
  username: string;
  real_name: string | undefined;
  dj_name: string | undefined;
};

export type DJRegistryRequestParams =
  | {
      username: string;
    }
  | DJRequestParams;

export type DJRequestParams = {
  dj_id: string; // User ID from better-auth (string)
};

export type DJInfoResponse = {
  id: number;
  add_date: string;
  username: string;
  dj_name: string;
  real_name: string;
  shows_covered: number;
};

export const djAttributeNames: Record<string, keyof VerifiedData> = {
  name: "realName",
  "custom:dj-name": "djName",
};

export const djAttributeTitles: Partial<Record<keyof VerifiedData, string>> = {
  realName: "Real Name",
  djName: "DJ Name",
  username: "Username",
  password: "Password",
  code: "Code",
  confirmPassword: "Confirm Password",
};

export type AccountModification = Partial<Record<keyof ModifiableData, string>>;

export const modifiableAttributeNames: Partial<Record<keyof ModifiableData, string>> = {
  realName: "name",
  djName: "custom:dj-name",
  email: "email",
};

export type BackendAccountModification = {
  username: string;
  dj_name: string | undefined;
  real_name: string | undefined;
};

/**
 * Maps a better-auth role string to the Authorization enum
 * 
 * Handles the following role types:
 * - WXYC custom roles: "member", "dj", "musicDirector", "stationManager"
 * - Role variations: "station_manager", "music_director" (with underscores)
 * - Better-auth default roles: "member", "user" (map to NO access)
 * - Owner/admin roles: If better-auth uses "owner" or "admin", they may need custom handling
 * 
 * Role hierarchy: SM (Station Manager) > MD (Music Director) > DJ > NO (No access)
 * 
 * @param role - The role string from better-auth (WXYCRole or any string)
 * @returns The corresponding Authorization enum value
 */
export function mapRoleToAuthorization(role: WXYCRole | string | undefined): Authorization {
  if (!role) {
    return Authorization.NO;
  }
  
  // Normalize role string (case-insensitive, handle underscores)
  const normalizedRole = role.toLowerCase().trim();
  
  switch (normalizedRole) {
    case "stationmanager":
    case "station_manager":
      return Authorization.SM;
    case "musicdirector":
    case "music_director":
    case "music-director":
      return Authorization.MD;
    case "dj":
      return Authorization.DJ;
    case "member":
    case "user":  // Base user role maps to member (NO access)
      return Authorization.NO;
    // Better-auth default roles that might be used
    case "owner":
    case "admin":
      // Owners/admins typically have full access, map to station manager
      // Adjust this mapping based on your business logic
      return Authorization.SM;
    default:
      // Unknown roles default to NO access
      return Authorization.NO;
  }
}
