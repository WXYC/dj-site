import {
  AuthenticationData,
  Credentials,
  isAuthenticated,
} from "@/lib/features/authentication/types";
import {
  defaultAuthenticationData,
  toClient,
} from "@/lib/features/authentication/utilities";
import {
  clearSession,
  getSession,
  sessionOptions,
  setSession,
} from "@/lib/features/session";
import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommand,
  RespondToAuthChallengeCommandInput,
  RespondToAuthChallengeCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// This client will be used to send commands to the Cognito Identity Provider
const client = new CognitoIdentityProviderClient({
  region: String(process.env.AWS_REGION),
});

//#region GET CURRENT USER
export async function GET(request: NextRequest) {
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
  if (!session?.refreshToken || !isAuthenticated(currentAuthenticationData)) {
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

    console.log("AuthenticationResult", result.AuthenticationResult);
    console.log("ChallengeName", result.ChallengeName);

    return NextResponse.json(toClient(result), { status: 200 });
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

    return handleCognitoResponse(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
//#endregion

//#region LOGOUT
export async function DELETE(request: NextRequest) {
  let response = NextResponse.json(defaultAuthenticationData, {
    status: 200,
  });

  //#region Cookie Management
  const cookieStore = await cookies();

  clearSession();

  const currentAuthenticationData: AuthenticationData =
    cookieStore.get("auth_state") !== undefined
      ? JSON.parse(String(cookieStore.get("auth_state")!.value))
      : defaultAuthenticationData;
  cookieStore.delete("auth_state");
  //#endregion

  //#region Cognito Logout
  try {
    if (!isAuthenticated(currentAuthenticationData)) return response;

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

//#region CHANGE PASSWORD
export async function PUT(request: NextRequest) {
  const { username, password, ...requiredAttributes } = await request.json();
  console.log("Username", username);
  console.log("Password", password);
  console.log("Required Attributes", requiredAttributes);

  const params: RespondToAuthChallengeCommandInput = {
    ClientId: String(process.env.AWS_USER_POOL_CLIENT_ID),
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    Session: String((await getSession())?.refreshToken),
    ChallengeResponses: {
      USERNAME: username,
      NEW_PASSWORD: password,
      ...Object.fromEntries(
        Object.entries(requiredAttributes).map(([key, value]) => [
          `userAttributes.${key}`,
          value,
        ])
      ),
    },
  };

  try {
    const response = await client.send(
      new RespondToAuthChallengeCommand(params)
    );
    return handleCognitoResponse(response);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
//#endregion

async function handleCognitoResponse(
  result: RespondToAuthChallengeCommandOutput | InitiateAuthCommandOutput
) {
  //#region Cookie Management
  const cookieStore = await cookies();

  if (result.ChallengeName) {
    if (result.ChallengeName !== "NEW_PASSWORD_REQUIRED")
      return NextResponse.json(
        { message: result.ChallengeName },
        { status: 400 }
      );

    await setSession(result.Session);
  } else if (result.AuthenticationResult) {
    await setSession(result.AuthenticationResult.RefreshToken);
  } else {
    await setSession(undefined);
  }
  //#endregion

  let response = toClient(result);

  cookieStore.set({
    ...sessionOptions.cookieOptions,
    name: "auth_state",
    value: JSON.stringify(response),
  });

  return NextResponse.json(response, { status: 200 });
}
