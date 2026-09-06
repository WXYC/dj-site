import { Account, AdminAuthenticationStatus, Authorization } from "./types";
import { roleToAuthorization } from "../authentication/types";

export type BetterAuthUser = {
  id: string;
  email: string;
  name: string;
  username?: string;
  emailVerified: boolean;
  realName?: string;
  djName?: string;
  role: "member" | "dj" | "musicDirector" | "stationManager";
  createdAt: Date;
  updatedAt: Date;
  banned?: boolean;
  banReason?: string;
  /** Cross-cutting capabilities independent of role hierarchy */
  capabilities?: string[];
  hasCompletedOnboarding?: boolean;
  selfSignupAt?: Date | null;
  selfSignupReviewedAt?: Date | null;
};

export function convertBetterAuthToAccountResult(
  user: BetterAuthUser
): Account {
  return {
    id: user.id,
    userName: user.username ?? "",
    realName: user.realName || "No Real Name",
    djName: user.djName || undefined,
    authorization: roleToAuthorization(user.role),
    authType: user.emailVerified
      ? AdminAuthenticationStatus.Confirmed
      : AdminAuthenticationStatus.New,
    email: user.email,
    capabilities: user.capabilities ?? [],
    hasCompletedOnboarding: user.hasCompletedOnboarding ?? false,
    // Better-auth's client parser revives ISO strings into real `Date`
    // objects; carry the raw ISO string past this boundary instead, so a
    // `Date` never lands in the RTK Query cache or the rightbar panel's
    // Redux payload (both trip `serializableCheck` outside production).
    selfSignupAt: user.selfSignupAt ? new Date(user.selfSignupAt).toISOString() : null,
    selfSignupReviewedAt: user.selfSignupReviewedAt
      ? new Date(user.selfSignupReviewedAt).toISOString()
      : null,
  };
}

export function mapBetterAuthRoleToAuthorization(
  role: "member" | "dj" | "musicDirector" | "stationManager"
): Authorization {
  return roleToAuthorization(role);
}

