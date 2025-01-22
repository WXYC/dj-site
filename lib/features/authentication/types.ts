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
