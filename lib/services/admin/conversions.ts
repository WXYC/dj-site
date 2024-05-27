import { DJ } from "@/lib/redux";
import { UserType } from "@aws-sdk/client-cognito-identity-provider";

export function convertUserToDJResult(backend: UserType): DJ {
    return {
        userName: backend.Username ?? "Error: No Username",
        realName: backend.Attributes?.find((attr) => attr.Name === "name")?.Value ?? "No Real Name",
        djName: backend.Attributes?.find((attr) => attr.Name === "custom:dj-name")?.Value ?? "No DJ Name",
        isAdmin: false,
    };
}