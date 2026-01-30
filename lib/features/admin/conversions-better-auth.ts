import { Account, AdminAuthenticationStatus, Authorization } from "./types";
import { mapRoleToAuthorization } from "../authentication/types";

// Better-auth user type (from admin API)
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
};

/**
 * Converts better-auth user to Account format
 */
export function convertBetterAuthToAccountResult(
  user: BetterAuthUser
): Account {
  return {
    id: user.id,
    userName: user.username || user.name,
    realName: user.realName || user.name || "No Real Name",
    djName: user.djName || "No DJ Name",
    authorization: mapRoleToAuthorization(user.role),
    authType: user.emailVerified 
      ? AdminAuthenticationStatus.Confirmed 
      : AdminAuthenticationStatus.New,
    email: user.email,
  };
}

/**
 * Maps better-auth role to Authorization enum
 */
export function mapBetterAuthRoleToAuthorization(
  role: "member" | "dj" | "musicDirector" | "stationManager"
): Authorization {
  return mapRoleToAuthorization(role);
}

