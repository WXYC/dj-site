import {
  UserStatusType,
  UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { Account, AdminAuthenticationStatus, Authorization } from "./types";

export function convertAWSToAccountResult(
  backend: UserType,
  stationManagersList: string[],
  musicDirectorsList: string[]
): Account {
  return {
    userName: backend.Username ?? "Error: No Username",
    realName:
      backend.Attributes?.find((attr) => attr.Name === "name")?.Value ??
      "No Real Name",
    djName:
      backend.Attributes?.find((attr) => attr.Name === "custom:dj-name")
        ?.Value ?? "No DJ Name",
    authorization: backend.Username
      ? stationManagersList.includes(backend.Username ?? "")
        ? Authorization.SM
        : musicDirectorsList.includes(backend.Username ?? "")
        ? Authorization.MD
        : Authorization.DJ
      : Authorization.NO,
    authType: convertBackendStatusToAuthentication(backend.UserStatus),
    email: backend.Attributes?.find((attr) => attr.Name === "email")?.Value,
  };
}

export function convertBackendStatusToAuthentication(
  backend: UserStatusType | undefined
): AdminAuthenticationStatus {
  switch (backend) {
    case "CONFIRMED":
      return AdminAuthenticationStatus.Confirmed;
    case "FORCE_CHANGE_PASSWORD":
      return AdminAuthenticationStatus.New;
    case "RESET_REQUIRED":
      return AdminAuthenticationStatus.Reset;
    default:
      return AdminAuthenticationStatus.New;
  }
}

export function getGroupNameFromAuthorization(
  authorization: Authorization
): string | undefined {
  switch (authorization) {
    case Authorization.SM:
      return process.env.AWS_SM_GROUP_NAME;
    case Authorization.MD:
      return process.env.AWS_MD_GROUP_NAME;
    default:
      return undefined;
  }
}
