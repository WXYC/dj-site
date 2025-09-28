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
  accessToken?: string;
  idToken?: string;
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

export const defaultAuthenticationSession: AuthenticationSession = {
  refreshToken: undefined,
  expiresAt: undefined,
};

export type AuthenticationSession = {
  refreshToken: string | undefined;
  expiresAt: Date | undefined;
};

export type Credentials = {
  username: string;
  password: string;
};

export type NewUserCredentials = Credentials & Record<string, string>;

export type User = {
  username: string;
  email: string;
  realName: string;
  djName: string;
  authority: Authorization;
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

export interface DJwtPayload extends JwtPayload {
  "cognito:username": string;
  email: string;
  name: string;
  "custom:dj-name": string;
  "cognito:groups"?: string[];
}

export type DJRegistryParams = {
  cognito_user_name: string;
  real_name: string | undefined;
  dj_name: string | undefined;
};

export type DJRegistryRequestParams =
  | {
      cognito_user_name: string;
    }
  | DJRequestParams;

export type DJRequestParams = {
  dj_id: number;
};

export type DJInfoResponse = {
  id: number;
  add_date: string;
  cognito_user_name: string;
  dj_name: string;
  real_name: string;
  shows_covered: number;
};

export const djAttributeNames: Record<string, keyof VerifiedData> = {
  name: "realName",
  "custom:dj-name": "djName",
};

export const djAttributeTitles: Record<keyof VerifiedData, string> = {
  realName: "Real Name",
  djName: "DJ Name",
  username: "Username",
  password: "Password",
  code: "Code",
  confirmPassword: "Confirm Password",
};

export type AccountModification = Partial<Record<keyof ModifiableData, string>>;

export const modifiableAttributeNames: Record<keyof ModifiableData, string> = {
  realName: "name",
  djName: "custom:dj-name",
  email: "email",
};

export type BackendAccountModification = {
  cognito_user_name: string;
  dj_name: string | undefined;
  real_name: string | undefined;
};
