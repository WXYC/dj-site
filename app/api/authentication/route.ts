import {
  AuthenticationData,
  AuthenticationSession,
  AuthenticationStage,
  Credentials,
} from "@/lib/features/authentication/types";
import {
  defaultAuthenticationData,
  toClient,
} from "@/lib/features/authentication/utilities";
import { sessionOptions } from "@/lib/features/session";
import { setDefault } from "@/lib/features/types";
import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  ICognitoUserPoolData,
} from "amazon-cognito-identity-js";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface AuthResult {
  stage?: AuthenticationStage;
  challengeName?: string;
  challengeParameters?: Record<string, string>;
  userAttributes?: Record<string, string>;
  session?: string;
  AuthenticationResult?: {
    IdToken: string;
    AccessToken: string;
    RefreshToken: string;
  };
}

// This client will be used to send commands to the Cognito Identity Provider
const client = new CognitoIdentityProviderClient({
  region: String(process.env.AWS_REGION),
});

//#region GET CURRENT USER
export async function GET(request: NextRequest) {
  let stage = AuthenticationStage.NotAuthenticated;

  //#region Cookie Retrieval
  const cookieStore = await cookies();

  const currentAuthenticationData: AuthenticationData = JSON.parse(
    String(
      cookieStore.get("auth_state")?.value ??
        JSON.stringify(defaultAuthenticationData)
    )
  );

  const session = await getIronSession<AuthenticationSession>(
    cookieStore,
    sessionOptions
  );

  // If we are already logged in or the data is not present, sign the user out and default
  if (
    !session?.refreshToken ||
    currentAuthenticationData.stage !== AuthenticationStage.Authenticated
  ) {
    return NextResponse.json(defaultAuthenticationData, { status: 200 });
  }
  //#endregion

  //#region Cognito Auth Flow with Refresh Token
  const params: InitiateAuthCommandInput = {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: String(process.env.AWS_USER_POOL_CLIENT_ID),
    AuthParameters: {
      REFRESH_TOKEN: String(session?.refreshToken),
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const result = await client.send(command);

    if (result.AuthenticationResult) stage = AuthenticationStage.Authenticated;

    return NextResponse.json(
      toClient(
        stage,
        result.AuthenticationResult?.IdToken,
        result.AuthenticationResult?.AccessToken
      ),
      { status: 200 }
    );
  } catch (error: any) {
    cookieStore.delete("auth_state");
    session.destroy();
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  //#endregion
}
//#endregion

//#region LOGIN
export async function POST(request: NextRequest) {
  const { username, password } = (await request.json()) as Credentials;
  let stage = AuthenticationStage.NotAuthenticated;

  try {
    //#region Cognito Auth Flow with Username and Password
    const userPoolData: ICognitoUserPoolData = {
      UserPoolId: String(process.env.AWS_USER_POOL_ID),
      ClientId: String(process.env.AWS_USER_POOL_CLIENT_ID),
    };

    const user = new CognitoUser({
      Username: username,
      Pool: new CognitoUserPool(userPoolData),
    });

    const authParameters = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    const result: AuthResult = await new Promise((resolve, reject) => {
      user.authenticateUser(authParameters, {
        onSuccess: (session) => {
          resolve({
            stage: AuthenticationStage.Authenticated,
            AuthenticationResult: {
              // We are using the JWT tokens for the client
              IdToken: session.getIdToken().getJwtToken(),
              AccessToken: session.getAccessToken().getJwtToken(),
              RefreshToken: session.getRefreshToken().getToken(),
            },
          });
        },
        onFailure: (error) => reject(error),
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          resolve({
            stage: AuthenticationStage.NewPassword,
            challengeName: "NEW_PASSWORD_REQUIRED",
            userAttributes,
          });
        },
      });
    });
    //#endregion

    stage = result.stage ?? stage;

    //#region Cookie Management
    const cookieStore = await cookies();
    const session = await getIronSession<AuthenticationSession>(
      cookieStore,
      sessionOptions
    );

    if (result.challengeName) {
      if (result.challengeName !== "NEW_PASSWORD_REQUIRED")
        return NextResponse.json(
          { message: result.challengeName },
          { status: 400 }
        );

      session.refreshToken = undefined;
    } else if (result.AuthenticationResult) {
      session.refreshToken = result.AuthenticationResult.RefreshToken;
    } else {
      setDefault(session);
    }

    await session.save();
    //#endregion

    let response = toClient(
      stage,
      result.AuthenticationResult?.IdToken,
      result.AuthenticationResult?.AccessToken
    );

    cookieStore.set({
      ...sessionOptions.cookieOptions,
      name: "auth_state",
      value: JSON.stringify(response),
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
//#endregion

//#region LOGOUT
export async function DELETE(request: NextRequest) {
  let response = NextResponse.json(toClient(AuthenticationStage.NotAuthenticated), {
    status: 200,
  });

  //#region Cookie Management
  const cookieStore = await cookies();

  const session = await getIronSession<AuthenticationSession>(
    cookieStore,
    sessionOptions
  );

  session.destroy();

  const currentAuthenticationData: AuthenticationData = JSON.parse(
    String(cookieStore.get("auth_state")?.value ?? defaultAuthenticationData)
  );
  cookieStore.delete("auth_state");
  //#endregion

  //#region Cognito Logout
  try {
    if (
      !currentAuthenticationData.user ||
      !currentAuthenticationData.accessToken
    )
      return response;

    const command = new GlobalSignOutCommand({
      AccessToken: currentAuthenticationData.accessToken,
    });

    await client.send(command);

    return response;
  } catch (error: any) {
    return response;
  }
  //#endregion
}
//#endregion
