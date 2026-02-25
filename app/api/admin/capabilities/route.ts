import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverAuthClient } from "@/lib/features/authentication/server-client";
import { betterAuthSessionToAuthenticationData } from "@/lib/features/authentication/utilities";
import { isAuthenticated } from "@/lib/features/authentication/types";
import { Authorization } from "@/lib/features/admin/types";
import type { BetterAuthSessionResponse } from "@/lib/features/authentication/utilities";

const VALID_CAPABILITIES = ["editor", "webmaster"] as const;
type Capability = (typeof VALID_CAPABILITIES)[number];

/**
 * PATCH /api/admin/capabilities
 *
 * Update a user's capabilities (cross-cutting permissions).
 *
 * Required: Station Manager (SM) authorization
 *
 * Body:
 * - userId: string - The user ID to update
 * - capabilities: string[] - The new capabilities array
 */
export async function PATCH(request: NextRequest) {
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

    // Only Station Managers can update capabilities
    if (authData.user?.authority !== Authorization.SM) {
      return NextResponse.json(
        { error: "Forbidden: Requires Station Manager privileges" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId, capabilities } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Bad Request: userId is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(capabilities)) {
      return NextResponse.json(
        { error: "Bad Request: capabilities must be an array" },
        { status: 400 }
      );
    }

    // Validate capability values
    const invalidCapabilities = capabilities.filter(
      (c: string) => !VALID_CAPABILITIES.includes(c as Capability)
    );
    if (invalidCapabilities.length > 0) {
      return NextResponse.json(
        {
          error: `Bad Request: Invalid capabilities: ${invalidCapabilities.join(", ")}. Valid values are: ${VALID_CAPABILITIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Update user capabilities via better-auth admin API
    // The better-auth admin plugin provides updateUser method
    const adminClient = serverAuthClient.admin as any;

    if (typeof adminClient?.updateUser === "function") {
      const result = await adminClient.updateUser(
        {
          userId,
          data: {
            capabilities,
          },
        },
        {
          fetchOptions: {
            headers: {
              cookie: cookieHeader,
            },
          },
        }
      );

      if (result.error) {
        console.error("Failed to update user capabilities:", result.error);
        return NextResponse.json(
          {
            error:
              result.error.message || "Failed to update user capabilities",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.data,
      });
    }

    // Fallback: Try HTTP endpoint directly
    const baseURL =
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";
    const response = await fetch(`${baseURL}/admin/set-user-capabilities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        userId,
        capabilities,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      console.error("Failed to update user capabilities:", errorData);
      return NextResponse.json(
        { error: errorData.message || "Failed to update user capabilities" },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in capabilities endpoint:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
