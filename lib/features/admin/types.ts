export type AdminFrontendState = {
  searchString: string;
  adding: boolean;
  formData: {
    authorization: Authorization;
  }
};

export enum Authorization {
  NO,
  DJ,
  MD,
  SM,
}

export type Account = {
  id?: string;
  userName: string;
  realName: string;
  djName: string;
  authorization: Authorization;
  authType: AdminAuthenticationStatus;
  shows?: string;
  email?: string;
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
