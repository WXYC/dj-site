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
};

export function convertBetterAuthToAccountResult(
  user: BetterAuthUser
): Account {
  return {
    id: user.id,
    userName: user.username || user.name,
    realName: user.realName || user.name || "No Real Name",
    djName: user.djName || undefined,
    authorization: roleToAuthorization(user.role),
    authType: user.emailVerified
      ? AdminAuthenticationStatus.Confirmed
      : AdminAuthenticationStatus.New,
    email: user.email,
    capabilities: user.capabilities ?? [],
    hasCompletedOnboarding: user.hasCompletedOnboarding ?? false,
  };
}

export function mapBetterAuthRoleToAuthorization(
  role: "member" | "dj" | "musicDirector" | "stationManager"
): Authorization {
  return roleToAuthorization(role);
}

