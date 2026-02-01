import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverAuthClient } from "@/lib/features/authentication/server-client";
import { betterAuthSessionToAuthenticationData } from "@/lib/features/authentication/utilities";
import { isAuthenticated } from "@/lib/features/authentication/types";
import { Authorization } from "@/lib/features/admin/types";
import type { BetterAuthSessionResponse } from "@/lib/features/authentication/utilities";

/**
 * POST /api/admin/send-password-setup
 *
 * Server-side endpoint to trigger a password setup email for a new user.
 * Uses Better Auth's forget-password endpoint, which will detect that the
 * user is new (no realName) and send an "account setup" email instead of
 * a "password reset" email.
 *
 * Required: Station Manager (SM) or Admin authorization
 *
 * Body:
 * - email: string - The email address of the user to send the setup email to
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const session = (await serverAuthClient.getSession({
      fetchOptions: {
        headers: {
          cookie: cookieHeader,
        },
      },
    })) as BetterAuthSessionResponse;

    if (!session.data) {
      return NextResponse.json(
        { error: "Unauthorized: Not authenticated" },
        { status: 401 }
      );
    }

    const authData = betterAuthSessionToAuthenticationData(session.data);

    if (!isAuthenticated(authData)) {
      return NextResponse.json(
        { error: "Unauthorized: Not authenticated" },
        { status: 401 }
      );
    }

    // Only Station Managers or Admins can send password setup emails
    const authority = authData.user?.authority;
    if (authority !== Authorization.SM && authority !== Authorization.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Requires Station Manager or Admin privileges" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Bad Request: email is required" },
        { status: 400 }
      );
    }

    // Trigger password reset via Better Auth
    // The backend detects new users (no realName) and sends accountSetup email
    const authBaseUrl =
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";

    // Determine the redirect URL for the password reset link
    const redirectTo =
      process.env.PASSWORD_RESET_REDIRECT_URL ||
      `${process.env.NEXT_PUBLIC_APP_URL || "https://wxyc.org"}/login`;

    const response = await fetch(`${authBaseUrl}/forget-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        redirectTo,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("Failed to send password setup email:", errorText);
      return NextResponse.json(
        { error: "Failed to send password setup email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in send-password-setup endpoint:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
