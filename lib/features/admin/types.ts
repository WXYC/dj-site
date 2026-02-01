import type { WXYCRole } from "../authentication/types";

export type AdminFrontendState = {
  searchString: string;
  adding: boolean;
  formData: {
    /**
     * @deprecated Use `role: WXYCRole` instead.
     */
    authorization: Authorization;
  };
};

/**
 * Authorization levels for WXYC users.
 *
 * @deprecated Use `WXYCRole` from `@wxyc/shared/auth-client` instead.
 * This enum will be removed in a future version.
 *
 * Migration guide:
 * - `Authorization.NO` → `"member"`
 * - `Authorization.DJ` → `"dj"`
 * - `Authorization.MD` → `"musicDirector"`
 * - `Authorization.SM` → `"stationManager"`
 * - `Authorization.ADMIN` → `"admin"`
 *
 * For permission checks, use capability functions from @wxyc/shared:
 * - `hasPermission(role, resource, action)`
 * - `canManageRoster(role)`
 * - `canAssignRoles(role)`
 * - `canPromoteToAdmin(role)`
 *
 * For numeric comparisons like `authority >= Authorization.SM`, use:
 * - `canManageRoster(role)` for roster access
 * - `hasPermission(role, "roster", "write")` for specific permission checks
 */
export enum Authorization {
  NO,
  DJ,
  MD,
  SM,
  ADMIN,
}

/**
 * @deprecated Use WXYCRole instead of Authorization for the authorization field.
 */
export type Account = {
  id?: string;
  userName: string;
  realName: string;
  djName: string;
  /**
   * @deprecated Use `role: WXYCRole` instead.
   */
  authorization: Authorization;
  authType: AdminAuthenticationStatus;
  shows?: string;
  email?: string;
};

/**
 * @deprecated Use WXYCRole instead of Authorization.
 */
export type NewAccountParams = {
  username: string;
  email: string;
  realName?: string;
  djName?: string;
  /**
   * @deprecated Use `role: WXYCRole` instead.
   */
  authorization: Authorization;
  temporaryPassword: string;
};

/**
 * @deprecated Use WXYCRole instead of Authorization.
 */
export type PromotionParams = {
  username: string;
  /**
   * @deprecated Use `currentRole: WXYCRole` instead.
   */
  currentAuthorization: Authorization;
  /**
   * @deprecated Use `newRole: WXYCRole` instead.
   */
  nextAuthorization: Authorization;
};

/**
 * Maps Authorization enum values to WXYCRole strings.
 * Use this helper during migration from Authorization to WXYCRole.
 *
 * @deprecated Migrate to using WXYCRole directly.
 */
export function authorizationToWXYCRole(auth: Authorization): WXYCRole {
  switch (auth) {
    case Authorization.ADMIN:
      return "admin";
    case Authorization.SM:
      return "stationManager";
    case Authorization.MD:
      return "musicDirector";
    case Authorization.DJ:
      return "dj";
    case Authorization.NO:
    default:
      return "member";
  }
}

/**
 * Maps WXYCRole strings to Authorization enum values.
 * Use this helper during migration from WXYCRole to Authorization.
 *
 * @deprecated Migrate to using WXYCRole directly.
 */
export function wxycRoleToAuthorization(role: WXYCRole): Authorization {
  switch (role) {
    case "admin":
      return Authorization.ADMIN;
    case "stationManager":
      return Authorization.SM;
    case "musicDirector":
      return Authorization.MD;
    case "dj":
      return Authorization.DJ;
    case "member":
    default:
      return Authorization.NO;
  }
}

export enum AdminAuthenticationStatus {
  Confirmed,
  New,
  Reset,
}

export interface AdminProtectedRoutesType {
  [key: string]: string[];
}

export const AdminProtectedRoutes: AdminProtectedRoutesType = {
  [Authorization.ADMIN]: ["roster", "catalog"],
  [Authorization.SM]: ["roster", "catalog"],
  [Authorization.MD]: ["catalog"],
  [Authorization.NO]: [],
};
