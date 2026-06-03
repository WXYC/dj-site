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
  realName?: string;          // Optional: User's real name
  djName?: string;            // Optional: DJ name/on-air name
  pronouns?: string;          // Optional: User's pronouns (e.g., "they/them")
  namePronunciation?: string; // Optional: Phonetic pronunciation guide
  showTimes?: string;         // Optional: When the DJ has their show
  title?: string;             // Optional: Role/title at the station
  semesterHired?: string;     // Optional: When they joined (e.g., "Fall 2024")
  bio?: string;               // Optional: Short biography
  location?: string;          // Optional: Where they're based
  authority: Authorization;
  // Better-auth fields (optional for compatibility)
  id?: string;
  name?: string;              // Username (duplicate of username)
  emailVerified?: boolean;
  appSkin?: string;           // UI theme
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

// Local field shim: BS#1320 (closes BS#1295) added `dj_name_override` to
// POST /flowsheet/join. The shared OpenAPI contract in @wxyc/shared/api.yaml
// has not been updated yet — remove this type and switch the joinShow
// mutation back to DJRequestParams once @wxyc/shared publishes the field.
export type JoinShowParams = DJRequestParams & {
  /**
   * Optional per-show override for the DJ's public handle. When present and
   * non-empty, the backend uses this value (instead of `auth_user.dj_name`)
   * for the show_start marker text + `flowsheet.dj_name` column +
   * `shows.legacy_dj_name` column. Co-host /join ignores it.
   */
  dj_name_override?: string;
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

