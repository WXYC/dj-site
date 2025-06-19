import { getAdminClient } from "@/lib/features/admin/client";
import {
  convertAWSToAcccountResult,
  getGroupNameFromAuthorization,
} from "@/lib/features/admin/conversions";
import { Authorization } from "@/lib/features/admin/types";
import {
  AdminAddUserToGroupCommand,
  AdminAddUserToGroupCommandInput,
  AdminCreateUserCommand,
  AdminCreateUserCommandInput,
  AdminDeleteUserCommand,
  AdminDeleteUserCommandInput,
  AdminRemoveUserFromGroupCommand,
  AdminRemoveUserFromGroupCommandInput,
  ListUsersCommand,
  ListUsersCommandInput,
  ListUsersInGroupCommand,
  ListUsersInGroupCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import { NextRequest, NextResponse } from "next/server";

//#region Get DJs
export async function GET(request: NextRequest) {
  try {
    const client = await getAdminClient();

    const params: ListUsersCommandInput = {
      UserPoolId: String(process.env.AWS_USER_POOL_ID),
      AttributesToGet: ["email", "name", "custom:dj-name"],
    };

    const listCommand = new ListUsersCommand(params);
    const listResponse = await client.send(listCommand);

    if (!listResponse.Users) {
      return NextResponse.json(
        {
          users: [],
        },
        { status: 200 }
      );
    }

    //#region Handle user groups
    const getStationManagersParams: ListUsersInGroupCommandInput = {
      UserPoolId: String(process.env.AWS_USER_POOL_ID),
      GroupName: getGroupNameFromAuthorization(Authorization.SM),
    };

    const getStationManagersCommand = new ListUsersInGroupCommand(
      getStationManagersParams
    );
    const stationManagersResponse = await client.send(
      getStationManagersCommand
    );

    const stationManagersList =
      stationManagersResponse.Users?.map((user) => user.Username ?? "") ?? [];

    const getMusicDirectorsParams: ListUsersInGroupCommandInput = {
      UserPoolId: String(process.env.AWS_USER_POOL_ID),
      GroupName: getGroupNameFromAuthorization(Authorization.MD),
    };

    const getMusicDirectorsCommand = new ListUsersInGroupCommand(
      getMusicDirectorsParams
    );
    const musicDirectorsResponse = await client.send(getMusicDirectorsCommand);

    const musicDirectorsList =
      musicDirectorsResponse.Users?.map((user) => user.Username ?? "") ?? [];
    //#endregion

    return NextResponse.json(
      {
        users: listResponse.Users.map((user) =>
          convertAWSToAcccountResult(
            user,
            stationManagersList,
            musicDirectorsList
          )
        ),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching DJs:", error);
    return NextResponse.json(
      {
        message: String(error),
      },
      { status: 500 }
    );
  }
}
//#endregion

//#region Create DJ
export async function POST(request: NextRequest) {
  try {
    const { username, email, realName, djName, temporaryPassword } =
      await request.json();

    const client = await getAdminClient();

    const params: AdminCreateUserCommandInput = {
      UserPoolId: String(process.env.AWS_USER_POOL_ID),
      Username: username,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name", Value: realName },
        { Name: "custom:dj-name", Value: djName },
        { Name: "email_verified", Value: "true" },
      ],
      TemporaryPassword: temporaryPassword,
    };

    const addCommand = new AdminCreateUserCommand(params);
    client.send(addCommand);

    return NextResponse.json(
      {
        message: "User created successfully",
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
//#endregion

//#region Delete DJ
export async function DELETE(request: NextRequest) {
  try {
    const { username } = await request.json();

    const client = await getAdminClient();

    const params: AdminDeleteUserCommandInput = {
      UserPoolId: String(process.env.AWS_USER_POOL_ID),
      Username: username,
    };

    const removeCommand = new AdminDeleteUserCommand(params);
    await client.send(removeCommand);

    return NextResponse.json(
      {
        message: `User ${username} deleted successfully`,
      },
      { status: 200 }
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
//#endregion

//#region Promote DJ
export async function PATCH(request: NextRequest) {
  try {
    const { username, currentAuthorization, nextAuthorization } =
      await request.json();

    const client = await getAdminClient();

    if (currentAuthorization === nextAuthorization) {
      return NextResponse.json(
        {
          message: "No change in authorization level",
        },
        { status: 400 }
      );
    }

    if (currentAuthorization === Authorization.NO) {
      return NextResponse.json(
        {
          message: "Cannot promote from NO authorization",
        },
        { status: 400 }
      );
    }

    if (nextAuthorization === Authorization.NO) {
      return NextResponse.json(
        {
          message: "Cannot demote to NO authorization",
        },
        { status: 400 }
      );
    }

    if (
      currentAuthorization === Authorization.SM ||
      currentAuthorization === Authorization.MD
    ) {
      const removeParams: AdminRemoveUserFromGroupCommandInput = {
        UserPoolId: String(process.env.AWS_USER_POOL_ID),
        Username: username,
        GroupName: getGroupNameFromAuthorization(currentAuthorization) ?? "",
      };

      const removeCommand = new AdminRemoveUserFromGroupCommand(removeParams);
      await client.send(removeCommand);
    }

    if (
      nextAuthorization === Authorization.SM ||
      nextAuthorization === Authorization.MD
    ) {
      const addParams: AdminAddUserToGroupCommandInput = {
        UserPoolId: String(process.env.AWS_USER_POOL_ID),
        Username: username,
        GroupName: getGroupNameFromAuthorization(nextAuthorization) ?? "",
      };

      const addCommand = new AdminAddUserToGroupCommand(addParams);
      await client.send(addCommand);
    }

    return NextResponse.json(
      {
        message: `User ${username} deleted successfully`,
      },
      { status: 200 }
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
//#endregion
