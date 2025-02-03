import { JwtPayload } from "jwt-decode";
import { Authorization } from "../admin/types";

export type AuthenticationState = {
  verifications: Verification<VerifiedData>;
};

export type AuthenticationData = {
  stage: AuthenticationStage;
  user?: User;
  accessToken?: string;
};

export const defaultAuthenticationSession: AuthenticationSession = {
  refreshToken: undefined,
};

export type AuthenticationSession = {
  refreshToken: string | undefined;
};

export enum AuthenticationStage {
  NotAuthenticated,
  NewUser,
  NewPassword,
  Authenticated,
}

export type Credentials = {
  username: string;
  password: string;
};

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

export type VerifiedData = Omit<User, "authority" | "email"> &
  Credentials &
  ResetPasswordCredentials & {
    confirmPassword: string;
  };

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
