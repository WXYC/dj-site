import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity"
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity"

export const getCredentials = async (idToken: string) => {

    const identityPoolId = process.env.NEXT_PUBLIC_AWS_ADMIN_IDENTITY_POOL_ID;

    if (!identityPoolId) {
        throw new Error("Identity Pool ID not found");
    }

    const credentialsProvider = fromCognitoIdentityPool({
        client: new CognitoIdentityClient({
            region: process.env.NEXT_PUBLIC_AWS_REGION
        }),
        identityPoolId,
        logins: {
            [`cognito-idp.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${process.env.NEXT_PUBLIC_USER_IDENTITY_POOL_ID}`]: idToken
        }
    });

    const credentials = await credentialsProvider();
    return credentials;
}