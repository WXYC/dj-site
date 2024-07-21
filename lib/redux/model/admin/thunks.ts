import { convertUserToDJResult } from "@/lib/services/admin/conversions";
import { AdminAddUserToGroupCommand, AdminAddUserToGroupCommandInput, AdminCreateUserCommand, AdminCreateUserCommandInput, AdminDeleteUserCommand, AdminDeleteUserCommandInput, AdminRemoveUserFromGroupCommand, AdminRemoveUserFromGroupCommandInput, AdminResetUserPasswordCommand, AdminResetUserPasswordCommandInput, CognitoIdentityProviderClient, ListUsersCommand, ListUsersCommandInput, ListUsersInGroupCommand, ListUsersInGroupCommandInput, VerifyUserAttributeCommandInput } from "@aws-sdk/client-cognito-identity-provider";
import { CatalogResult, DJ, ProposedArtist, getCredentials, getReleasesMatching } from "../..";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";
import { onlyUnique } from "@/lib/utilities/unique";

export const fetchDJs = createAppAsyncThunk(
    "admin/fetchDJs",
    async (): Promise<DJ[]> => {

        const client = await getAdminClient();

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

export type AccountInput = {
    dj: DJ,
    temporaryPassword: string
};

export const autoCompleteArtist = createAppAsyncThunk(
    "admin/autoCompleteArtist",
    async (input: string): Promise<ProposedArtist[]> => {
        
        const results: CatalogResult[] | null = await getReleasesMatching({
            term: input,
            n: 5,
            medium: "Artists",
            genre: "All",
        });

        const mappedData = results?.map((result) => {
            return {
                name: result.album.artist.name,
                genre: result.album.artist.genre,
                numbercode: result.album.artist.numbercode,
                lettercode: result.album.artist.lettercode
            };
        }) ?? [];

        const uniqueData = onlyUnique(mappedData, "name");

        return uniqueData;
    }
);

export const addDJ = createAppAsyncThunk(
    "admin/addDJ",
    async (input: AccountInput): Promise<void> => {
        
        const client = await getAdminClient();

        const params: AdminCreateUserCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            Username: input.dj.userName,
            UserAttributes: [
                {
                    Name: "email",
                    Value: input.dj.email
                },
                {
                    Name: "name",
                    Value: input.dj.realName
                },
                {
                    Name: "custom:dj-name",
                    Value: input.dj.djName
                },
                {
                    Name: "email_verified",
                    Value: "true"
                }
            ],
            TemporaryPassword: input.temporaryPassword
        };

        const addCommand = new AdminCreateUserCommand(params);

        try {
            await client.send(addCommand);

        } catch (error) {
            throw error;
        }

        return;
    }
);

export const removeDJ = createAppAsyncThunk(
    "admin/removeDJ",
    async (dj: DJ): Promise<void> => {
        
        const client = await getAdminClient();

        const params: AdminDeleteUserCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            Username: dj.userName
        };

        const removeCommand = new AdminDeleteUserCommand(params);
        const removeResponse = await client.send(removeCommand);

        return;
    }
);

export const resetPassword = createAppAsyncThunk(
    "admin/resetPassword",
    async (args: AccountInput): Promise<void> => {
        
        const client = await getAdminClient();

        const params: AdminResetUserPasswordCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            Username: args.dj.userName
        };

        const removeCommand = new AdminResetUserPasswordCommand(params);
        const removeResponse = await client.send(removeCommand);

        return;
    }
);


export const populateAdmins = createAppAsyncThunk(
    "admin/getAdmins",
    async (): Promise<DJ[]> => {
        
        const client = await getAdminClient();

        const params: ListUsersInGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: process.env.NEXT_PUBLIC_AWS_ADMIN_GROUP_NAME
        }

        const listCommand = new ListUsersInGroupCommand(params);
        const listResponse = await client.send(listCommand);

        return listResponse.Users?.map((user) => convertUserToDJResult(user)) ?? [];
    }
);

export const populateMusicDirectors = createAppAsyncThunk(
    "admin/getMusicDirectors",
    async (): Promise<DJ[]> => {
        
        const client = await getAdminClient();

        const params: ListUsersInGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: process.env.NEXT_PUBLIC_AWS_MD_GROUP_NAME
        }

        const listCommand = new ListUsersInGroupCommand(params);
        const listResponse = await client.send(listCommand);

        return listResponse.Users?.map((user) => convertUserToDJResult(user)) ?? [];
    }
);

export const makeAdmin = createAppAsyncThunk(
    "admin/makeAdmin",
    async (dj: DJ): Promise<void> => {
        
        const client = await getAdminClient();
        
        const params: AdminAddUserToGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: process.env.NEXT_PUBLIC_AWS_ADMIN_GROUP_NAME,
            Username: dj.userName
        };

        const addCommand = new AdminAddUserToGroupCommand(params);
        const addResponse = await client.send(addCommand);

        return;
    }
);

export const makeMusicDirector = createAppAsyncThunk(
    "admin/makeMusicDirector",
    async (dj: DJ): Promise<void> => {
        
        const client = await getAdminClient();
        
        const params: AdminAddUserToGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: process.env.NEXT_PUBLIC_AWS_MD_GROUP_NAME,
            Username: dj.userName
        };

        const addCommand = new AdminAddUserToGroupCommand(params);
        const addResponse = await client.send(addCommand);

        return;
    }
);

export const removeAdmin = createAppAsyncThunk(
    "admin/removeAdmin",
    async (dj: DJ): Promise<void> => {
        
        const client = await getAdminClient();

        const params: AdminRemoveUserFromGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: process.env.NEXT_PUBLIC_AWS_ADMIN_GROUP_NAME,
            Username: dj.userName
        };

        const removeCommand = new AdminRemoveUserFromGroupCommand(params);
        const removeResponse = await client.send(removeCommand);

        return;
    }
);

export const removeMusicDirector = createAppAsyncThunk(
    "admin/removeMusicDirector",
    async (dj: DJ): Promise<void> => {
        
        const client = await getAdminClient();

        const params: AdminRemoveUserFromGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: process.env.NEXT_PUBLIC_AWS_MD_GROUP_NAME,
            Username: dj.userName
        };

        const removeCommand = new AdminRemoveUserFromGroupCommand(params);
        const removeResponse = await client.send(removeCommand);

        return;
    }
);


const getAdminClient = async (): Promise<CognitoIdentityProviderClient> => {

    let idToken = sessionStorage.getItem("idToken") ?? "";

    const client = new CognitoIdentityProviderClient({
        credentials: await getCredentials(idToken),
        region: process.env.NEXT_PUBLIC_AWS_REGION
    });

    return client;
};