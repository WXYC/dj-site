import {
  AuthenticationData,
  AuthenticationStage,
  Credentials,
} from "@/lib/features/authentication/types";
import {
  defaultAuthenticationData,
  toClient,
} from "@/lib/features/authentication/utilities";
import { clearSession, getSession, sessionOptions, setSession } from "@/lib/features/session";
import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
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

  const session = await getSession();

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
    await clearSession();
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
    const params: InitiateAuthCommandInput = {
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
      ClientId: String(process.env.AWS_USER_POOL_CLIENT_ID),
    };

    const command = new InitiateAuthCommand(params);
    const result = await client.send(command);
    //#endregion

    //#region Cookie Management
    const cookieStore = await cookies();

    if (result.ChallengeName) {
      if (result.ChallengeName !== "NEW_PASSWORD_REQUIRED")
        return NextResponse.json(
          { message: result.ChallengeName },
          { status: 400 }
        );

      await setSession(undefined);
    } else if (result.AuthenticationResult) {
      await setSession(result.AuthenticationResult.RefreshToken);
      stage = AuthenticationStage.Authenticated;
    } else {
      await setSession(undefined);
    }
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
  let response = NextResponse.json(
    toClient(AuthenticationStage.NotAuthenticated),
    {
      status: 200,
    }
  );

  //#region Cookie Management
  const cookieStore = await cookies();

  clearSession();

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
