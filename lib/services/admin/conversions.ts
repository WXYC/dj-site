import { AdminAuthenticationStatus, AdminType, DJ } from "@/lib/redux";
import { UserStatusType, UserType } from "@aws-sdk/client-cognito-identity-provider";

export function convertUserToDJResult(backend: UserType): DJ {
    return {
        userName: backend.Username ?? "Error: No Username",
        realName: backend.Attributes?.find((attr) => attr.Name === "name")?.Value ?? "No Real Name",
        djName: backend.Attributes?.find((attr) => attr.Name === "custom:dj-name")?.Value ?? "No DJ Name",
        adminType: AdminType.None,
        authType: convertBackendStatusToAuthentication(backend.UserStatus),
        email: backend.Attributes?.find((attr) => attr.Name === "email")?.Value
    };
}

export function convertBackendStatusToAuthentication(backend: UserStatusType | undefined): AdminAuthenticationStatus
{
    switch (backend)
    {
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