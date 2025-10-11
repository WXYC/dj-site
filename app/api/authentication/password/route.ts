import { ResetPasswordRequest } from "@/lib/features/authentication/types";
import { getSession } from "@/lib/features/session";
import {
  ConfirmForgotPasswordCommand,
  ConfirmForgotPasswordCommandInput,
  ForgotPasswordCommand,
  ForgotPasswordCommandInput,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
  RespondToAuthChallengeCommand,
  RespondToAuthChallengeCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextRequest, NextResponse } from "next/server";
import {
  client,
  handleCognitoResponse,
  handleForgotPasswordFlow,
} from "../utilities";


export async function GET(request: NextRequest) {
  // get from params
  const { username } = Object.fromEntries(new URL(request.url).searchParams);
  if (!username) {
    return NextResponse.json(
      { message: "Username is required" },
      { status: 400 }
    );
  }

  const params: ForgotPasswordCommandInput = {
    ClientId: String(process.env.AWS_USER_POOL_CLIENT_ID),
    Username: String(username),
  };

  try {
    const response = await client.send(new ForgotPasswordCommand(params));
    return handleForgotPasswordFlow(username, response);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const { username, code, password } =
    (await request.json()) as ResetPasswordRequest;

    console.log("POST", { username, code, password });
  if (!username || !code || !password) {   
    return NextResponse.json(
      { message: "Username, code, and password are required" },
      { status: 400 }
    );
  }

  const params: ConfirmForgotPasswordCommandInput = {
    ClientId: String(process.env.AWS_USER_POOL_CLIENT_ID),
    Username: String(username),
    ConfirmationCode: String(code),
    Password: String(password),
  };

  try {
    await client.send(new ConfirmForgotPasswordCommand(params));

    const authParams: InitiateAuthCommandInput = {
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
      ClientId: String(process.env.AWS_USER_POOL_CLIENT_ID),
    };

    const command = new InitiateAuthCommand(authParams);
    const result = await client.send(command);

    return handleCognitoResponse(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const { username, password, ...requiredAttributes } = await request.json();

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
