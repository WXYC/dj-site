import { getAdminClient } from "@/lib/features/admin/client";
import {
  AdminResetUserPasswordCommand,
  AdminResetUserPasswordCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextRequest, NextResponse } from "next/server";


export async function PATCH(request: NextRequest) {
  try {
    const { username } = await request.json();

    const client = await getAdminClient();

    const params: AdminResetUserPasswordCommandInput = {
      UserPoolId: String(process.env.AWS_USER_POOL_ID),
      Username: username,
    };

    const addCommand = new AdminResetUserPasswordCommand(params);
    await client.send(addCommand);

    return NextResponse.json(
      {
        message: `${username}'s password has been reset.`,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: String(error),
      },
      { status: 500 }
    );
  }
}
