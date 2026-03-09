import { JwtPayload } from "jwt-decode";
import { Authorization } from "../admin/types";
import { roleToAuthorization } from "@wxyc/shared/auth-client/auth";

export type { WXYCRole } from "@wxyc/shared/auth-client/auth";
import type { WXYCRole } from "@wxyc/shared/auth-client/auth";

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
    (data as PasswordResetUser)?.confirmationMessage !== undefined
  );
}

export type PasswordResetUser = {
  confirmationMessage: string;
  token?: string;
  error?: string;
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
    currentPassword: string;
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

/** @deprecated Use roleToAuthorization from @wxyc/shared/auth-client/auth directly */
export const mapRoleToAuthorization = roleToAuthorization;
