import "server-only";
import { serverAuthClient, serverAuthFetch } from "./server-client";
import { normalizeRole, organizationRoleFromJwtToken } from "./organization-utils";
import { WXYCRole } from "./types";

async function fetchAuthJwtToken(cookieHeader?: string): Promise<string | null> {
  try {
    const { ok, data } = await serverAuthFetch<{ token?: unknown }>("/token", {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (!ok) {
      return null;
    }
    return typeof data?.token === "string" ? data.token : null;
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
    // The client SDK's findOrganizationBySlug returns 404, so call the API directly.
    const { ok, status, data } = await serverAuthFetch<{
      id?: string;
      code?: string;
      message?: string;
    }>(
      `/organization/get-full-organization?organizationSlug=${encodeURIComponent(organizationSlugOrId)}`,
      {
        method: "GET",
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      }
    );

    if (!ok) {
      // A failed slug lookup must NOT be treated as an ID: returning the slug
      // as a UUID silently downgrades the user to NO authority.
      console.error("Failed to resolve organization slug:", {
        code: data?.code,
        message: data?.message,
        status,
      });
      return undefined;
    }

    if (data?.id) {
      return data.id;
    }

    // No organization found by slug: assume the input is already an ID.
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
