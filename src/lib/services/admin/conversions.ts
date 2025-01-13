import { Authority, User } from "@/lib/models";
import { UserType } from "@aws-sdk/client-cognito-identity-provider";

export function cognitoUserToUser(backend: UserType): User {
    return {
        username: backend.Username ?? "Error: No Username",
        name: backend.Attributes?.find((attr) => attr.Name === "name")?.Value ?? "No Real Name",
        djName: backend.Attributes?.find((attr) => attr.Name === "custom:dj-name")?.Value ?? "No DJ Name",
        email: backend.Attributes?.find((attr) => attr.Name === "email")?.Value,
        authority: Authority.DJ
    };
}