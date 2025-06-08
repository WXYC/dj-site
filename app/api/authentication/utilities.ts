import { AuthenticationData, PasswordResetUser } from "@/lib/features/authentication/types";
import { toClient } from "@/lib/features/authentication/utilities";
import { sessionOptions, setSession } from "@/lib/features/session";
import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommandOutput,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";


export const runtime = "edge";

// This client will be used to send commands to the Cognito Identity Provider
export const client = new CognitoIdentityProviderClient({
  region: String(process.env.AWS_REGION),
});

export async function handleForgotPasswordFlow(
    username: string,
    result: ForgotPasswordCommandOutput
)
{
    await setSession(undefined);
    const cookieStore = await cookies();

    if (result.CodeDeliveryDetails) {
        const response : PasswordResetUser = {
            username: username,
            confirmationMessage: `A code has been sent to ${result.CodeDeliveryDetails.Destination}.`,
        }

        cookieStore.set({
            ...sessionOptions.cookieOptions,
            name: "auth_state",
            value: JSON.stringify(response),
          });

        return NextResponse.json(
            response,
            { status: 200 }
        );
    }

    return NextResponse.json(
        { message: "No code delivery details found." },
        { status: 400 }
    );
}

export async function handleCognitoResponse(
  result: RespondToAuthChallengeCommandOutput | InitiateAuthCommandOutput
) {
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

  let response = toClient(result);

  cookieStore.set({
    ...sessionOptions.cookieOptions,
    name: "auth_state",
    value: JSON.stringify(response),
  });

  return NextResponse.json(response, { status: 200 });
}
