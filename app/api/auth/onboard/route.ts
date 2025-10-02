import { getSession } from "@/lib/features/authentication/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, realName, djName } = body;

    if (!token || !password || !realName) {
      return NextResponse.json(
        { error: "Token, password, and real name are required" },
        { status: 400 }
      );
    }

    // Validate onboarding token
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64url').toString());
      if (tokenData.exp < Date.now()) {
        return NextResponse.json(
          { error: "Onboarding token has expired" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid onboarding token" },
        { status: 400 }
      );
    }

    // TODO: Update user with onboarding data using better-auth
    // For now, we'll simulate the user update
    const userData = {
      user: {
        id: tokenData.userId,
        email: `user${tokenData.userId}@example.com`, // This would come from the database
        username: `user${tokenData.userId}`, // This would come from the database
        realName,
        djName: djName || realName,
        onboarded: true,
      }
    };

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
      user: {
        id: userData.user.id,
        email: userData.user.email,
        username: userData.user.username,
        realName: userData.user.realName,
        djName: userData.user.djName,
        onboarded: true,
      },
    });

  } catch (error) {
    console.error(`[Onboarding] Error completing onboarding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to validate onboarding token and get user info
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Validate onboarding token
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64url').toString());
      if (tokenData.exp < Date.now()) {
        return NextResponse.json(
          { error: "Onboarding token has expired" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid onboarding token" },
        { status: 400 }
      );
    }

    // TODO: Get user info from database using better-auth
    // For now, we'll simulate the user data
    const userData = {
      user: {
        id: tokenData.userId,
        email: `user${tokenData.userId}@example.com`,
        username: `user${tokenData.userId}`,
        realName: "",
        djName: "",
        onboarded: false,
      }
    };

    return NextResponse.json({
      valid: true,
      user: {
        id: userData.user.id,
        email: userData.user.email,
        username: userData.user.username,
        realName: userData.user.realName || "",
        djName: userData.user.djName || "",
        onboarded: userData.user.onboarded || false,
      },
    });

  } catch (error) {
    console.error(`[Onboarding] Error validating token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
