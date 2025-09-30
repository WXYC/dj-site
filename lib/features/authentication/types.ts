import { JwtPayload } from "jwt-decode";
import { Authorization } from "../admin/types";

// Note: better-auth types are extended through the client configuration
// The additionalFields in authClient will be included in the user object

// Type for better-auth session with our custom user fields
export type BetterAuthUser = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  banned?: boolean | null;
  role?: string;
  banReason?: string | null;
  banExpires?: Date | null;
  username?: string;
  // Our custom fields
  realName?: string;
  djName?: string;
  appSkin?: string;
};

export type AuthenticationState = {
  session: Session;
  verifications: Verification<VerifiedData>;
  modifications: Verification<ModifiableData>;
  required: (keyof VerifiedData)[];
};

export type Session = {
  loading: boolean;
  user: User | null;
};

export type ServerSideProps = {
  application: {
    appSkin: AppSkin;
  };
  authentication: {
    user: User;
  } | null;
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

export type AppSkin = "classic" | "modern-light" | "modern-dark";

export type User = {
  id: string;
  username: string;
  email: string;
  realName: string;
  djName: string;
  authority: Authorization;
  appSkin: AppSkin;
};

export type ResetPasswordCredentials = {
  code: string;
  password: string;
};

export type ResetPasswordRequest = ResetPasswordCredentials & {
  username: string;
};

export type VerifiedData = Omit<
  User,
  "id" | "authority" | "email" | "appSkin"
> &
  Credentials &
  ResetPasswordCredentials & {
    confirmPassword: string;
  };

export type ModifiableData = Omit<
  User,
  "id" | "authority" | "username" | "appSkin"
>;

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

// AppSkin utility functions
export function getAppSkinFromUser(user: { appSkin?: string } | null): AppSkin {
  if (
    user?.appSkin &&
    (user.appSkin === "classic" || user.appSkin === "modern-light" || user.appSkin === "modern-dark")
  ) {
    return user.appSkin as AppSkin;
  }
  return "modern-light";
}

export function getAppSkinFromRedux(authenticationState: {
  session: { user: any };
}): AppSkin {
  return getAppSkinFromUser(authenticationState.session.user);
}

export function isValidAppSkin(value: string): value is AppSkin {
  return value === "classic" || value === "modern";
}
