import {
  AccountModification,
  AuthenticationData,
  Credentials,
  isAuthenticated,
  modifiableAttributeNames,
} from "@/lib/features/authentication/types";
import {
  defaultAuthenticationData,
  toClient,
} from "@/lib/features/authentication/utilities";
import { clearSession, getSession } from "@/lib/features/session";
import {
  GlobalSignOutCommand,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
  UpdateUserAttributesCommand,
  UpdateUserAttributesCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  client,
  handleCognitoResponse,
  handleUpdateUserAttributesResponse,
} from "./utilities";

export const runtime = "edge";

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

export async function PATCH(request: NextRequest) {
  //#region Cookie Retrieval
  const cookieStore = await cookies();

  const currentAuthenticationData: AuthenticationData = JSON.parse(
    String(
      cookieStore.get("auth_state")?.value ??
        JSON.stringify(defaultAuthenticationData)
    )
  );
  //#endregion

  try {
    if (!isAuthenticated(currentAuthenticationData))
      return NextResponse.json(
        { message: "Not authenticated!" },
        { status: 400 }
      );

    const modifications = (await request.json()) as AccountModification;

    const params: UpdateUserAttributesCommandInput = {
      AccessToken: currentAuthenticationData.accessToken,
      UserAttributes: Object.entries(modifications).map(([key, value]) => ({
        Name: modifiableAttributeNames[key as keyof AccountModification],
        Value: String(value),
      })),
    };

    const command = new UpdateUserAttributesCommand(params);
    const result = await client.send(command);

    return handleUpdateUserAttributesResponse({ result, modifications });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
