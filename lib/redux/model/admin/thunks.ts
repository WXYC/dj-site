import { CognitoIdentityProviderClient, ListUsersCommand, ListUsersCommandInput } from "@aws-sdk/client-cognito-identity-provider";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";
import { User } from "../authentication";
import { getCredentials } from "../..";

export const fetchDJs = createAppAsyncThunk(
    "admin/fetchDJs",
    async (idToken: string): Promise<boolean> => {

        const client = new CognitoIdentityProviderClient({
            credentials: await getCredentials(idToken),
            region: process.env.NEXT_PUBLIC_AWS_REGION
        });

        const params: ListUsersCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID,
            AttributesToGet: [
                "email",
                "name",
                "custom:dj-name",
            ]
        };

        const listCommand = new ListUsersCommand(params);
        const listResponse = await client.send(listCommand);

        console.table(listResponse);
        console.table(listResponse.Users);

        return true;
    }
);