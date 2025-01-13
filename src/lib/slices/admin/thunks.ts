import { createAppAsyncThunk } from "@/lib/createAppAsyncThunk";
import { AdminAddUserToGroupCommand, AdminAddUserToGroupCommandInput, AdminCreateUserCommand, AdminCreateUserCommandInput, AdminDeleteUserCommand, AdminDeleteUserCommandInput, AdminRemoveUserFromGroupCommand, AdminRemoveUserFromGroupCommandInput, AdminResetUserPasswordCommand, AdminResetUserPasswordCommandInput, CognitoIdentityProviderClient, ListUsersCommand, ListUsersCommandInput, ListUsersInGroupCommand, ListUsersInGroupCommandInput, VerifyUserAttributeCommandInput } from "@aws-sdk/client-cognito-identity-provider";
import { Authority, User } from "../../models/authentication";
import { cognitoUserToUser, getCredentials } from "@/lib/services/admin";
import { fetchAuthSession } from "@aws-amplify/auth";
import { toast } from "sonner";

export const fetchDJs = createAppAsyncThunk(
    "admin/fetchDJs",
    async (): Promise<User[]> => {

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
        const listResponse = await client?.send(listCommand);

        return listResponse?.Users?.map(cognitoUserToUser) ?? [];
    }
);

export type AccountInput = {
    dj: User,
    temporaryPassword: string
};

/* export const autoCompleteArtist = createAppAsyncThunk(
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
); */

export const addDJ = createAppAsyncThunk(
    "admin/addDJ",
    async (input: AccountInput): Promise<void> => {
        
        const client = await getAdminClient();

        const params: AdminCreateUserCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            Username: input.dj.username,
            UserAttributes: [
                {
                    Name: "email",
                    Value: input.dj.email
                },
                {
                    Name: "name",
                    Value: input.dj.name
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
            await client?.send(addCommand);
            toast.success(`Successfully added ${input.dj.username} to the system.`);
        } catch (error) {
            throw error;
        }

        return;
    }
);

export const removeDJ = createAppAsyncThunk(
    "admin/removeDJ",
    async (dj: User): Promise<void> => {
        
        const client = await getAdminClient();

        const params: AdminDeleteUserCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            Username: dj.username
        };

        const removeCommand = new AdminDeleteUserCommand(params);
        const removeResponse = await client?.send(removeCommand);

        return;
    }
);

export const resetAccount = createAppAsyncThunk(
    "admin/resetAccount",
    async (args: User): Promise<void> => {
        
        const client = await getAdminClient();

        const params: AdminResetUserPasswordCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            Username: args.username
        };

        const removeCommand = new AdminResetUserPasswordCommand(params);
        const removeResponse = await client?.send(removeCommand);

        return;
    }
);


export const populateAdmins = createAppAsyncThunk(
    "admin/getAdmins",
    async (): Promise<{ StationManagers: User[], MusicDirectors: User[] }> => {
        
        const client = await getAdminClient();

        const smParams: ListUsersInGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: "station-management"
        }

        const listSMCommand = new ListUsersInGroupCommand(smParams);
        const listSMResponse = await client?.send(listSMCommand);
        
        const mdParams: ListUsersInGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: "music-management"
        }

        const listMDCommand = new ListUsersInGroupCommand(mdParams);
        const listMDResponse = await client?.send(listMDCommand);

        return {
            StationManagers: listSMResponse?.Users?.map(cognitoUserToUser) ?? [],
            MusicDirectors: listMDResponse?.Users?.map(cognitoUserToUser) ?? []
        };
    }
);

export const promote = createAppAsyncThunk(
    "admin/promote",
    async (props: { dj: User, authority: Authority }): Promise<void> => {

        if (props.authority < Authority.MD) return;

        const client = await getAdminClient();
        
        const params: AdminAddUserToGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: props.authority === Authority.SM ? "station-management" : "music-management",
            Username: props.dj.username
        };

        const addCommand = new AdminAddUserToGroupCommand(params);
        const addResponse = await client?.send(addCommand);

        return;
    }
);

export const demote = createAppAsyncThunk(
    "admin/demote",
    async (dj: User): Promise<void> => {

        if (dj.authority < Authority.MD) return;

        const client = await getAdminClient();
        
        const params: AdminRemoveUserFromGroupCommandInput = {
            UserPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
            GroupName: dj.authority === Authority.SM ? "station-management" : "music-management",
            Username: dj.username
        };

        const removeCommand = new AdminRemoveUserFromGroupCommand(params);
        const removeResponse = await client?.send(removeCommand);

        return;
    }
);

const getAdminClient = async (): Promise<CognitoIdentityProviderClient | undefined> => {

    let idToken = (await fetchAuthSession()).tokens?.idToken;

    if (!idToken) return undefined;

    const client = new CognitoIdentityProviderClient({
        credentials: await getCredentials(idToken.toString()),
        region: process.env.NEXT_PUBLIC_AWS_REGION
    });

    return client;
};