import {
  AccountModification,
  AuthenticatedUser,
  PasswordResetUser,
} from "@/lib/features/authentication/types";
import { toClient } from "@/lib/features/authentication/utilities";
import { sessionOptions, setSession } from "@/lib/features/session";
import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommandOutput,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommandOutput,
  UpdateUserAttributesCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// This client will be used to send commands to the Cognito Identity Provider
// Explicitly configure to prevent file system access in Cloudflare Workers
export const client = new CognitoIdentityProviderClient({
  region: String(process.env.AWS_REGION),
  // Prevent AWS SDK from trying to read credentials from filesystem
  credentials: undefined,
  // Ensure SDK doesn't try to load config from files
  runtime: "browser",
});

export async function handleForgotPasswordFlow(
  username: string,
  result: ForgotPasswordCommandOutput
) {
  await setSession(undefined);
  const cookieStore = await cookies();

  if (result.CodeDeliveryDetails) {
    const response: PasswordResetUser = {
      username: username,
      confirmationMessage: `A code has been sent to ${result.CodeDeliveryDetails.Destination}.`,
    };

    cookieStore.set({
      ...sessionOptions.cookieOptions,
      name: "auth_state",
      value: JSON.stringify(response),
    });

    return NextResponse.json(response, { status: 200 });
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

export async function handleUpdateUserAttributesResponse({
  result,
  modifications,
}: {
  result: UpdateUserAttributesCommandOutput;
  modifications: AccountModification;
}) {
  if (
    !result.$metadata.httpStatusCode ||
    result.$metadata.httpStatusCode !== 200
  ) {
    return NextResponse.json(
      { message: "Failed to update user attributes." },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const currentAuthenticationData: AuthenticatedUser = JSON.parse(
    String(cookieStore.get("auth_state")?.value ?? JSON.stringify({}))
  );

  const updatedData = {
    ...currentAuthenticationData,
    user: {
      ...currentAuthenticationData.user,
      ...modifications,
    },
  };

  cookieStore.set({
    ...sessionOptions.cookieOptions,
    name: "auth_state",
    value: JSON.stringify(updatedData),
  });

  return NextResponse.json(updatedData, { status: 200 });
}
