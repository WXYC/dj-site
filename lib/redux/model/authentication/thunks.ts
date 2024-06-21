import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  GetUserCommandOutput,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import {
  AuthenticationState,
  BackendResponse,
  DJwtPayload,
  getter,
  nullState,
  setter,
  updater,
} from "../..";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";
import { LoginCredentials } from "./types";

export const login = createAppAsyncThunk(
  "authentication/authenticateAsync",
  async (credentials: LoginCredentials): Promise<AuthenticationState> => {
    
    console.log("Logging in with credentials: ", credentials);

    const client = new CognitoIdentityProviderClient({
      region: process.env.NEXT_PUBLIC_AWS_REGION,
    });

    const params: InitiateAuthCommandInput = {
      ClientId: process.env.NEXT_PUBLIC_AWS_CLIENT_ID,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: credentials.username,
        PASSWORD: credentials.password,
      },
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
            session: authResponse.Session,
          },
        };
      } else {

        console.log("Auth response: ", authResponse);

        const accessToken = authResponse.AuthenticationResult?.AccessToken;
        sessionStorage.setItem("accessToken", accessToken || "");
        sessionStorage.setItem(
          "refreshToken",
          authResponse.AuthenticationResult?.RefreshToken || ""
        );
        sessionStorage.setItem(
          "idToken",
          authResponse.AuthenticationResult?.IdToken || ""
        );

        var jwt_payload = jwtDecode<DJwtPayload>(
          authResponse?.AuthenticationResult?.IdToken || ""
        );

        var isAdmin: boolean =
          jwt_payload["cognito:groups"]?.includes("station-management") ||
          false;

        const getUserCommmand = new GetUserCommand({
          AccessToken: accessToken,
        });
        console.log("Getting user with command: ", getUserCommmand);
        const userResponse = await client.send(getUserCommmand);

        console.log("User response: ", userResponse);

        if (!userResponse.Username || !userResponse.UserAttributes) {
          return nullState;
        }

        const { data: backendData, error: backendError } = await backendSync(
          userResponse
        );

        if (backendError || !backendData) {
          toast.error(
            "The backend is out of sync with the user database. This is fatal. Contact a site admin immediately."
          );
          return nullState;
        }

        let djName = "";
        if (!backendData.dj_name || !backendData.real_name) {
          const { data: updateData, error: updateError } = await updater(
            `djs/register`
          )({
            cognito_user_name: userResponse.Username,
            real_name: userResponse?.UserAttributes?.find(
              (attr) => attr.Name == "name"
            )?.Value,
            dj_name: userResponse?.UserAttributes?.find(
              (attr) => attr.Name == "custom:dj-name"
            )?.Value,
          });

          if (updateError) {
            toast.error(
              "The backend is out of sync with the user database. This is fatal. Contact a site admin immediately."
            );
            return nullState;
          }

          djName = updateData.dj_name;
        }

        return {
          authenticating: false,
          isAuthenticated: true,
          user: {
            username: userResponse.Username || credentials.username,
            djName:
              backendData.dj_name ||
              userResponse.UserAttributes?.find(
                (x) => x.Name == "custom:dj-name"
              )?.Value ||
              "",
            djId: Number(backendData.id),
            name:
              backendData.real_name ||
              userResponse.UserAttributes?.find((x) => x.Name == "name")
                ?.Value ||
              "",
            isAdmin: isAdmin,
            showRealName: false,
          },
        };
      }
    } catch (error) {
      toast.error("Invalid username or password");
      return nullState;
    }
  }
);

export const verifySession = createAppAsyncThunk(
  "authentication/verifyAuthenticationAsync",
  async (): Promise<AuthenticationState> => {

    console.log("Verifying session");

    const accessToken = sessionStorage.getItem("accessToken");
    const idToken = sessionStorage.getItem("idToken");

    if (!idToken || !accessToken) {
      return nullState;
    }

    const client = new CognitoIdentityProviderClient({
      region: process.env.NEXT_PUBLIC_AWS_REGION,
    });

    var jwt_payload = jwtDecode<DJwtPayload>(idToken);
    const isAdmin: boolean =
      jwt_payload["cognito:groups"]?.includes("station-management") || false;

    try {
      const getUserCommmand = new GetUserCommand({
        AccessToken: accessToken,
      });
      console.log("Getting user with command: ", getUserCommmand);
      const userResponse = await client.send(getUserCommmand);
      console.log("User response: ", userResponse);

      return processUserResponse(userResponse, isAdmin);
    } catch (error: any) {
      if (
        error == "Access Token has expired" ||
        error?.message == "Access Token has expired"
      ) {
        return refreshTokenLogin(client);
      }

      toast.error("Could not log you in.");
      return nullState;
    }
  }
);

const refreshTokenLogin = async (
  client: CognitoIdentityProviderClient
): Promise<AuthenticationState> => {
  const refreshToken = sessionStorage.getItem("refreshToken");

  if (!refreshToken) {
    return nullState;
  }

  const params: InitiateAuthCommandInput = {
    ClientId: process.env.NEXT_PUBLIC_AWS_CLIENT_ID,
    AuthFlow: "REFRESH_TOKEN_AUTH",
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  };

  try {
    const authCommand = new InitiateAuthCommand(params);
    const authResponse = await client.send(authCommand);

    const accessToken = authResponse.AuthenticationResult?.AccessToken;
    sessionStorage.setItem("accessToken", accessToken || "");
    sessionStorage.setItem(
      "refreshToken",
      authResponse.AuthenticationResult?.RefreshToken || ""
    );
    sessionStorage.setItem(
      "idToken",
      authResponse.AuthenticationResult?.IdToken || ""
    );

    var jwt_payload = jwtDecode<DJwtPayload>(
      authResponse?.AuthenticationResult?.IdToken || ""
    );
    const isAdmin: boolean =
      jwt_payload["cognito:groups"]?.includes("station-management") || false;

    const getUserCommmand = new GetUserCommand({
      AccessToken: accessToken,
    });
    const userResponse = await client.send(getUserCommmand);

    return processUserResponse(userResponse, isAdmin);
  } catch (error: any) {
    toast.error("Could not log you back in.");
    return nullState;
  }
};

const processUserResponse = async (
  userResponse: GetUserCommandOutput,
  isAdmin: boolean
): Promise<AuthenticationState> => {
  if (!userResponse.Username || !userResponse.UserAttributes) {
    return nullState;
  }

  const { data: backendData, error: backendError } = await backendSync(
    userResponse
  );
  if (backendError || !backendData) {
    toast.error(
      "The backend is out of sync with the user database. This is fatal. Contact a site admin immediately."
    );
    return nullState;
  }

  return {
    authenticating: false,
    isAuthenticated: true,
    user: {
      username: userResponse.Username,
      djId: Number(backendData.id),
      djName:
        userResponse.UserAttributes?.find((x) => x.Name == "custom:dj-name")
          ?.Value || "",
      name:
        userResponse.UserAttributes?.find((x) => x.Name == "name")?.Value || "",
      isAdmin: isAdmin,
      showRealName: false,
    },
  };
};

const backendSync = async (
  userData: GetUserCommandOutput
): Promise<BackendResponse> => {
  // BEGIN BACKEND SYNC ----------------------------------------------------------------------------
  const { data: backendData, error: backendError } = await getter(
    `djs?cognito_user_name=${userData.Username}`
  )();

  if (backendError) {
    if (backendError.message.includes("404")) {
      const { data: creationData, error: creationError } = await setter(
        `djs/register`
      )({
        cognito_user_name: userData.Username,
        real_name: userData?.UserAttributes?.find((attr) => attr.Name == "name")
          ?.Value,
        dj_name: userData?.UserAttributes?.find(
          (attr) => attr.Name == "custom:dj-name"
        )?.Value,
      });

      if (creationError) {
        return { data: null, error: creationError };
      }

      return { data: creationData, error: null };
    } else {
      toast.error(
        "The backend is out of sync with the user database. This is fatal. Contact a site admin immediately."
      );
    }
  } else {
    return { data: backendData, error: null };
  }
  // END BACKEND SYNC ------------------------------------------------------------------------------
  return { data: null, error: null };
};
