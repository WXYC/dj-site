import { serverAuthClient } from "./server-client";
import { normalizeRole } from "./organization-utils";
import { WXYCRole } from "./types";

// Re-export client-safe functions for convenience
export { getAppOrganizationId, getAppOrganizationIdClient } from "./organization-utils";

/**
 * Server-side: Resolve organization slug to organization ID
 * @param organizationSlugOrId - The organization slug (e.g., "wxyc") or ID
 * @param cookieHeader - Cookie header string for authenticated requests
 * @returns The organization ID, or undefined if not found
 */
async function resolveOrganizationId(
  organizationSlugOrId: string,
  cookieHeader?: string
): Promise<string | undefined> {
  try {
    // Make direct HTTP request to better-auth API to get organization by slug
    // The client SDK's findOrganizationBySlug returns 404, so we'll use the API directly
    const baseURL = process?.env?.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";
    const response = await fetch(`${baseURL}/organization/get-full-organization?organizationSlug=${encodeURIComponent(organizationSlugOrId)}`, {
      method: 'GET',
      headers: cookieHeader ? {
        cookie: cookieHeader,
      } : {},
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orgResult: any;
    if (response.ok) {
      const data = await response.json();
      orgResult = { data, error: null };
    } else {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      orgResult = { data: null, error: { code: errorData.code, message: errorData.message || response.statusText, status: response.status, statusText: response.statusText } };
    }

    if (orgResult.error) {
      // Log the actual error to understand why slug lookup failed
      console.error("Failed to resolve organization slug:", orgResult.error);
      // If slug lookup fails, we should NOT use it as an ID - return undefined to fail gracefully
      return undefined;
    }

    if (orgResult.data?.id) {
      return orgResult.data.id;
    }

    // If no organization found by slug, assume it's already an ID
    return organizationSlugOrId;
  } catch (error) {
    console.error("Exception resolving organization ID from slug:", error);
    // If slug resolution fails, assume it might already be an ID
    return organizationSlugOrId;
  }
}

/**
 * Server-side: Get user's role in a specific organization
 * @param userId - The user ID to look up
 * @param organizationSlugOrId - The organization slug (e.g., "wxyc") or ID
 * @param cookieHeader - Cookie header string for authenticated requests
 * @returns The user's role in the organization, or undefined if not found or on error
 */
export async function getUserRoleInOrganization(
  userId: string,
  organizationSlugOrId: string,
  cookieHeader?: string
): Promise<WXYCRole | undefined> {
  try {
    // Resolve slug to ID if needed
    const organizationId = await resolveOrganizationId(organizationSlugOrId, cookieHeader);
    
    if (!organizationId) {
      return undefined;
    }

    const result = await serverAuthClient.organization.listMembers({
      query: {
        organizationId,
        filterField: "userId",
        filterOperator: "eq",
        filterValue: userId,
        limit: 1,
      },
      fetchOptions: cookieHeader ? {
        headers: {
          cookie: cookieHeader,
        },
      } : undefined,
    });

    if (result.error) {
      console.error("Error fetching organization member role:", result.error);
      return undefined;
    }

    // Find the member matching the userId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = result.data?.members?.find((m: any) => m.userId === userId);
    
    if (!member) {
      // User is not a member of this organization
      return undefined;
    }

    // Extract role from member object
    // Better-auth organization roles: "owner", "admin", "member" by default
    // But may be customized to our roles: "member", "dj", "musicDirector", "stationManager"
    const role = member.role as string | undefined;
    
    if (!role) {
      return undefined;
    }

    // Normalize and return the role
    return normalizeRole(role) as WXYCRole;
  } catch (error) {
    console.error("Exception fetching organization member role:", error);
    return undefined;
  }
}
