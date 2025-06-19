import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { cookies } from "next/headers";
import { AuthenticationData, isAuthenticated } from "../authentication/types";
import { defaultAuthenticationData } from "../authentication/utilities";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { Authorization } from "./types";

export async function getAdminCredentials() {
  const cookieStore = await cookies();

  const currentAuthenticationData: AuthenticationData = JSON.parse(
    String(
      cookieStore.get("auth_state")?.value ??
        JSON.stringify(defaultAuthenticationData)
    )
  );

  if (
    !isAuthenticated(currentAuthenticationData) ||
    !currentAuthenticationData.idToken
  ) {
    throw new Error("User is not authenticated");
  }

  if (
    currentAuthenticationData.user?.authority !== Authorization.SM
  )
  {
    throw new Error("User does not have admin privileges");
  }

  const cognitoProvider = fromCognitoIdentityPool({
    client: new CognitoIdentityClient({
      region: String(process.env.AWS_REGION),
    }),
    identityPoolId: String(process.env.AWS_IDENTITY_POOL_ID),
    logins: {
      [`cognito-idp.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${process.env.NEXT_PUBLIC_AWS_USER_POOL_ID}`]:
        currentAuthenticationData.idToken,
    },
  });

  return await cognitoProvider();
}


export async function getAdminClient() {
    return new CognitoIdentityProviderClient({
        credentials: await getAdminCredentials(),
        region: String(process.env.AWS_REGION),
    });
}