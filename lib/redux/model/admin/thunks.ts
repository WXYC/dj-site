import { CognitoIdentityProviderClient, ListUsersCommand, ListUsersCommandInput } from "@aws-sdk/client-cognito-identity-provider";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";
import { User } from "../authentication";
import { DJ, applicationSlice, getCredentials } from "../..";
import { convertUserToDJResult } from "@/lib/services/admin/conversions";

export const fetchDJs = createAppAsyncThunk(
    "admin/fetchDJs",
    async (): Promise<DJ[]> => {

        let idToken = sessionStorage.getItem("idToken") ?? "";

        const client = new CognitoIdentityProviderClient({
            credentials: await getCredentials(idToken),
            region: process.env.NEXT_PUBLIC_AWS_REGION
        });

        const params: ListUsersCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            AttributesToGet: [
                "email",
                "name",
                "custom:dj-name"
            ],

        };

        const listCommand = new ListUsersCommand(params);
        const listResponse = await client.send(listCommand);

        return listResponse.Users?.map((user) => convertUserToDJResult(user)) ?? [];
    }
);

export const addDJ = createAppAsyncThunk(
    "admin/addDJ",
    async (dj: DJ): Promise<void> => {
        // Add DJ to Cognito
        // Add DJ to DynamoDB
    }
)