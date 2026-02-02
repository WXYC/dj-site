import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverAuthClient } from "@/lib/features/authentication/server-client";
import { betterAuthSessionToAuthenticationData } from "@/lib/features/authentication/utilities";
import { isAuthenticated } from "@/lib/features/authentication/types";
import { Authorization } from "@/lib/features/admin/types";
import type { BetterAuthSessionResponse } from "@/lib/features/authentication/utilities";

/**
 * POST /api/admin/organization/add-member
 *
 * Server-side endpoint to add a user directly to an organization.
 * This bypasses the invitation flow and immediately adds the user as a member.
 *
 * Required: Station Manager (SM) authorization
 *
 * Body:
 * - userId: string - The user ID to add
 * - organizationId: string - The organization ID
 * - role: string - The role to assign (e.g., "member", "dj", "musicDirector", "stationManager")
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const session = await serverAuthClient.getSession({
      fetchOptions: {
        headers: {
          cookie: cookieHeader,
        },
      },
    }) as BetterAuthSessionResponse;

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

    // Only Station Managers can add members
    if (authData.user?.authority !== Authorization.SM) {
      return NextResponse.json(
        { error: "Forbidden: Requires Station Manager privileges" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId, organizationId, role } = body;

    if (!userId || !organizationId || !role) {
      return NextResponse.json(
        { error: "Bad Request: userId, organizationId, and role are required" },
        { status: 400 }
      );
    }

    // Try to use the SDK's addMember method if available
    // This is a server-side only function that bypasses the invitation flow
    // If not available, fall back to inviting the member (which requires acceptance)
    let result: any;
    let usedInvitation = false;

    // Check if organization SDK has addMember method
    const orgClient = serverAuthClient.organization as any;
    if (typeof orgClient?.addMember === "function") {
      // Use SDK method directly
      const addResult = await orgClient.addMember({
        userId,
        organizationId,
        role,
      }, {
        fetchOptions: {
          headers: {
            cookie: cookieHeader,
          },
        },
      });

      if (addResult.error) {
        console.error("SDK addMember failed:", addResult.error);
        return NextResponse.json(
          { error: addResult.error.message || "Failed to add member to organization" },
          { status: 400 }
        );
      }
      result = addResult.data;
    } else {
      // Fallback: Try HTTP endpoint (may not exist on all Better Auth servers)
      const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";
      const response = await fetch(`${baseURL}/organization/add-member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookieHeader,
        },
        body: JSON.stringify({
          userId,
          organizationId,
          role,
        }),
      });

      if (!response.ok) {
        // If add-member endpoint doesn't exist (404), try inviteMember as fallback
        // Note: This requires the user to accept the invitation
        if (response.status === 404) {
          console.warn("add-member endpoint not available, falling back to invitation");

          // Get user email for invitation
          const userResult = await serverAuthClient.admin.listUsers({
            query: {
              filterField: "id",
              filterValue: userId,
              limit: 1,
            },
            fetchOptions: {
              headers: {
                cookie: cookieHeader,
              },
            },
          });

          const userEmail = userResult.data?.users?.[0]?.email;
          if (!userEmail) {
            return NextResponse.json(
              { error: "Could not find user email for invitation" },
              { status: 400 }
            );
          }

          // Send invitation (user will need to accept)
          const inviteResult = await serverAuthClient.organization.inviteMember({
            email: userEmail,
            organizationId,
            role: role as "admin" | "member" | "owner",
          });

          if (inviteResult.error) {
            return NextResponse.json(
              { error: inviteResult.error.message || "Failed to invite member" },
              { status: 400 }
            );
          }

          result = inviteResult.data;
          usedInvitation = true;
        } else {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          console.error("Failed to add member to organization:", errorData);
          return NextResponse.json(
            { error: errorData.message || "Failed to add member to organization" },
            { status: response.status }
          );
        }
      } else {
        result = await response.json();
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      // Indicate if invitation was used (requires user acceptance) vs direct add
      usedInvitation,
    });
  } catch (error) {
    console.error("Error in add-member endpoint:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
