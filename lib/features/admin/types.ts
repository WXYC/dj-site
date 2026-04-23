export { Authorization } from "@wxyc/shared/auth-client/auth";
import { Authorization } from "@wxyc/shared/auth-client/auth";

export const ROSTER_PAGE_SIZE = 50;

export type AdminFrontendState = {
  searchString: string;
  page: number;
  totalAccounts: number;
  adding: boolean;
  formData: {
    authorization: Authorization;
  }
};

export type Account = {
  id?: string;
  userName: string;
  realName: string;
  djName?: string;
  authorization: Authorization;
  authType: AdminAuthenticationStatus;
  shows?: string;
  email?: string;
  /** Cross-cutting capabilities independent of role hierarchy */
  capabilities?: string[];
  /** Whether the user has completed the onboarding flow */
  hasCompletedOnboarding?: boolean;
};

export type NewAccountParams = {
  username: string;
  email: string;
  realName?: string;
  djName?: string;
  authorization: Authorization;
  temporaryPassword: string;
};

export type PromotionParams = {
  username: string;
  currentAuthorization: Authorization;
  nextAuthorization: Authorization;
};

export enum AdminAuthenticationStatus {
  Confirmed,
  New,
  Reset,
}

export interface AdminProtectedRoutesType {
  [key: string]: string[];
}

export const AdminProtectedRoutes: AdminProtectedRoutesType = {
  [Authorization.SM]: ["roster", "catalog"],
  [Authorization.MD]: ["catalog"],
  [Authorization.NO]: [],
};
