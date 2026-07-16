import { JwtPayload } from "jwt-decode";
import { Authorization } from "../admin/types";

export {
  type WXYCRole,
  roleToAuthorization,
  authorizationToRole,
  AUTHORIZATION_LABELS,
} from "@wxyc/shared/auth-client/auth";
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
  realName?: string;
  djName?: string;
  pronouns?: string;
  namePronunciation?: string;
  showTimes?: string;
  title?: string;
  semesterHired?: string;
  bio?: string;
  location?: string;
  authority: Authorization;
  id?: string;
  name?: string;              // Username (duplicate of username)
  emailVerified?: boolean;
  appSkin?: string;
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


export interface BetterAuthJwtPayload extends JwtPayload {
  sub?: string;
  id?: string;         // User ID (better-auth may include both)
  email: string;
  role: WXYCRole;
  exp: number;
  iat: number;
  iss?: string;
  aud?: string;
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

export const djAttributeTitles: Partial<Record<keyof VerifiedData, string>> = {
  realName: "Real Name",
  djName: "DJ Name",
  pronouns: "Pronouns",
  namePronunciation: "Name Pronunciation",
  showTimes: "Show Times",
  title: "Title",
  semesterHired: "Semester Hired",
  bio: "Bio",
  location: "Location",
  username: "Username",
  password: "Password",
  code: "Code",
  confirmPassword: "Confirm Password",
};

export type AccountModification = Partial<Record<keyof ModifiableData, string>>;

export type BackendAccountModification = {
  username: string;
  dj_name: string | undefined;
  real_name: string | undefined;
};

