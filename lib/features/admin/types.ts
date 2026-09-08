export { Authorization } from "@wxyc/shared/auth-client/auth";
import { Authorization, ROLES, roleToAuthorization } from "@wxyc/shared/auth-client/auth";

// Defined beside the predicate that reads it; re-exported here because the
// roster's state shape is the vocabulary the components import.
import type { OnboardingFilter, ReviewFilter } from "./roster-filter";
export type { OnboardingFilter, ReviewFilter };

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
  /** Which side of the manager review queue the table is narrowed to. */
  reviewFilter: ReviewFilter;
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
  /**
   * When the account row was first written, and when it was last changed.
   * ISO strings for the same reason as the self-signup fields below: a `Date`
   * here would round-trip through Redux and trip `serializableCheck`. Null
   * when the payload carries no timestamp -- the roster must say it does not
   * know rather than invent a date.
   *
   * `updatedAt` is better-auth's own column: it moves on any write to the user
   * row (role, email, name, onboarding flag), not only on edits made here.
   */
  createdAt?: string | null;
  updatedAt?: string | null;
  /**
   * Set when the account was created through station self-signup. An ISO
   * string, not a `Date`: nothing in the app reads the value beyond a null
   * check, and a `Date` here would round-trip through Redux (the RTK Query
   * roster cache and the rightbar panel payload), tripping
   * `serializableCheck` outside production.
   */
  selfSignupAt?: string | null;
  /**
   * Set once a manager clears the review. An ISO string for the same reason
   * as `selfSignupAt` above. Never `selfSignupReviewedBy` — that field is
   * `returned: false` server-side (it names the reviewing manager) and never
   * reaches this payload; approve still writes it, it is just not read back
   * here.
   */
  selfSignupReviewedAt?: string | null;
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
