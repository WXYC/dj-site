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

/**
 * Normalize a timestamp arriving from better-auth into an ISO string.
 *
 * Every timestamp crossing this boundary goes through here: better-auth's
 * client parser revives ISO strings into real `Date` objects, and a `Date`
 * landing in the RTK Query roster cache or the rightbar panel's Redux payload
 * trips `serializableCheck` outside production. An absent or unparseable value
 * becomes null so the roster can say it does not know.
 */
function toIsoStringOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

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
    createdAt: toIsoStringOrNull(user.createdAt),
    updatedAt: toIsoStringOrNull(user.updatedAt),
    selfSignupAt: toIsoStringOrNull(user.selfSignupAt),
    selfSignupReviewedAt: toIsoStringOrNull(user.selfSignupReviewedAt),
  };
}

export function mapBetterAuthRoleToAuthorization(
  role: "member" | "dj" | "musicDirector" | "stationManager"
): Authorization {
  return roleToAuthorization(role);
}

