export { Authorization } from "@wxyc/shared/auth-client/auth";
import { Authorization, ROLES, roleToAuthorization } from "@wxyc/shared/auth-client/auth";

// Defined beside the predicate that reads it; re-exported here because the
// roster's state shape is the vocabulary the components import.
import type { OnboardingFilter } from "./roster-filter";
export type { OnboardingFilter };

/**
 * Every station role a picker can offer, least privileged first.
 *
 * Derived from the shared role list rather than spelled out, so a role added
 * there cannot be silently missing from the roster's pickers — which is how
 * the four hand-maintained copies this replaced would have drifted.
 */
export const ROSTER_ROLES: Authorization[] = [...new Set(ROLES.map(roleToAuthorization))].sort(
  (a, b) => a - b
);

export const ROSTER_PAGE_SIZE = 50;

/**
 * Accounts per `admin/list-users` request while walking the whole roster.
 * Sized to fetch a station the size of WXYC in one request, with the walk in
 * `fetchAllAccounts` covering anything larger.
 */
export const ROSTER_FETCH_CHUNK_SIZE = 500;

/**
 * User ids per `organization/list-members` request. Kept well below the
 * fetch chunk because these ids travel in the query string.
 */
export const ROSTER_MEMBER_CHUNK_SIZE = 50;

export type AdminFrontendState = {
  searchString: string;
  /** Roles the table is narrowed to; empty means every role. */
  roleFilter: Authorization[];
  /** Which side of the signup flow the table is narrowed to. */
  onboardingFilter: OnboardingFilter;
  page: number;
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
