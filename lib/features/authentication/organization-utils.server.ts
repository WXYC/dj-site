import { serverAuthClient, getServerAuthBaseURL } from "./server-client";
import { normalizeRole, organizationRoleFromJwtToken } from "./organization-utils";
import { WXYCRole } from "./types";

async function fetchAuthJwtToken(cookieHeader?: string): Promise<string | null> {
  const baseURL = getServerAuthBaseURL();
  try {
    const response = await fetch(`${baseURL}/token`, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return typeof data.token === "string" ? data.token : null;
  } catch {
    return null;
  }
}

// Re-export client-safe functions for convenience
export { getAppOrganizationId, getAppOrganizationIdClient } from "./organization-utils";

async function resolveOrganizationId(
  organizationSlugOrId: string,
  cookieHeader?: string
): Promise<string | undefined> {
  try {
    // The client SDK's findOrganizationBySlug returns 404, so we use the API directly
    const baseURL = getServerAuthBaseURL();
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
    // A transient failure resolving the slug must not be treated as an ID:
    // returning the slug as a UUID silently downgrades the user to NO authority.
    return undefined;
  }
}

export async function getUserRoleInOrganization(
  userId: string,
  organizationSlugOrId: string,
  cookieHeader?: string
): Promise<WXYCRole | undefined> {
  try {
    if (cookieHeader) {
      const jwtToken = await fetchAuthJwtToken(cookieHeader);
      if (jwtToken) {
        const jwtRole = organizationRoleFromJwtToken(jwtToken, userId);
        if (jwtRole) {
          return jwtRole;
        }
      }
    }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = result.data?.members?.find((m: any) => m.userId === userId);

    if (!member) {
      return undefined;
    }

    // Better-auth organization roles default to "owner"/"admin"/"member" but
    // may be customized to ours: "member", "dj", "musicDirector", "stationManager"
    const role = member.role as string | undefined;

    if (!role) {
      return undefined;
    }

    return normalizeRole(role) as WXYCRole;
  } catch (error) {
    console.error("Exception fetching organization member role:", error);
    return undefined;
  }
}
