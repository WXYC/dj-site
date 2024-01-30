
import { CognitoIdentityProviderClient, GetUserCommand, InitiateAuthCommand, InitiateAuthCommandInput } from "@aws-sdk/client-cognito-identity-provider";
import { jwtDecode } from 'jwt-decode';
import { toast } from 'sonner';
import { AuthenticationState, DJwtPayload, nullState } from "../..";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";
import { LoginCredentials } from "./types";

export const login = createAppAsyncThunk(
    "authentication/authenticateAsync",
    async (credentials: LoginCredentials): Promise<AuthenticationState> => {
        const client = new CognitoIdentityProviderClient({
            region: process.env.NEXT_PUBLIC_AWS_REGION
        });

        const params: InitiateAuthCommandInput = {
            ClientId: process.env.NEXT_PUBLIC_AWS_CLIENT_ID,
            AuthFlow: "USER_PASSWORD_AUTH",
            AuthParameters: {
                USERNAME: credentials.username,
                PASSWORD: credentials.password
            }
        };

        try {
            const authCommand = new InitiateAuthCommand(params);
            const authResponse = await client.send(authCommand);

            if (authResponse.ChallengeName == "NEW_PASSWORD_REQUIRED") {
                return {
                    authenticating: false,
                    isAuthenticated: false,
                    user: {
                        username: credentials.username,
                        resetPassword: true,
                        session: authResponse.Session
                    }
                };
            } else {
                const accessToken = authResponse.AuthenticationResult?.AccessToken;
                sessionStorage.setItem("accessToken", accessToken || "");
                sessionStorage.setItem("refreshToken", authResponse.AuthenticationResult?.RefreshToken || "");
                sessionStorage.setItem("idToken", authResponse.AuthenticationResult?.IdToken || "");

                var jwt_payload = jwtDecode<DJwtPayload>(authResponse?.AuthenticationResult?.IdToken || "");

                var isAdmin: boolean = jwt_payload["cognito:groups"]?.includes("station-management") || false;

                const getUserCommmand = new GetUserCommand({
                    AccessToken: accessToken
                });
                const userResponse = await client.send(getUserCommmand);

                return {
                    authenticating: false,
                    isAuthenticated: true,
                    user: {
                        username: userResponse.Username || credentials.username,
                        djName: userResponse.UserAttributes?.find(x => x.Name == "custom:dj-name")?.Value || "",
                        name: userResponse.UserAttributes?.find(x => x.Name == "name")?.Value || "",
                        isAdmin: isAdmin,
                        showRealName: false
                    }
                };
            }
        } catch (error) {
            toast.error("Invalid username or password");
            return nullState;
        }
    },
);

export const verifySession = createAppAsyncThunk(
    "authentication/verifyAuthenticationAsync",
    async (): Promise<boolean> => {
        const accessToken = sessionStorage.getItem("accessToken");
        const refreshToken = sessionStorage.getItem("refreshToken");
        const idToken = sessionStorage.getItem("idToken");

        if (!idToken || !accessToken || !refreshToken) {
            return false;
        }

        const client = new CognitoIdentityProviderClient({
            region: process.env.NEXT_PUBLIC_AWS_REGION
        });

        try {
            const getUserCommmand = new GetUserCommand({
                AccessToken: accessToken
            });
            await client.send(getUserCommmand);

            return true;
        } catch (error) {
            return false;
        }
        
    }
);