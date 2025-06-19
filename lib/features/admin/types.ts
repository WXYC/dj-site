export enum Authorization {
  NO,
  DJ,
  MD,
  SM,
}

export interface Account {
  userName: string;
  realName: string;
  djName: string;
  authorization: Authorization;
  authType: AdminAuthenticationStatus;
  shows?: string;
  email?: string;
}

export interface NewAccountParams {
  username: string;
  email: string;
  realName: string;
  djName: string;
  temporaryPassword: string;
}

export interface PromotionParams {
  username: string;
  currentAuthorization: Authorization;
  nextAuthorization: Authorization;
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
  [Authorization.SM]: ["roster", "catalog"],
  [Authorization.MD]: ["catalog"],
  [Authorization.NO]: [],
};
