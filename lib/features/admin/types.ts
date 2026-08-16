export { Authorization } from "@wxyc/shared/auth-client/auth";
import { Authorization } from "@wxyc/shared/auth-client/auth";

export const ROSTER_PAGE_SIZE = 50;

/**
 * How many organization memberships the roster fetches to resolve roles. The
 * roster compares this against the membership total and refuses to render a
 * truncated answer, so raising it is only needed once the station passes this
 * many accounts.
 */
export const MEMBER_PAGE_SIZE = 1000;

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
  hasCompletedOnboarding?: boolean;
};

export type NewAccountParams = {
  username: string;
  email: string;
  realName?: string;
  djName?: string;
  authorization: Authorization;
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
