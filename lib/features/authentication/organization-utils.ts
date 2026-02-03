import { authClient } from "./client";
import { WXYCRole } from "./types";

/**
 * Get the organization slug or ID from APP_ORGANIZATION environment variable (server-side)
 * Returns undefined if not set (will log warning in development)
 * 
 * Note: This can be either a slug (e.g., "wxyc") or an organization ID.
 * The code will automatically resolve slugs to IDs when needed.
 */
export function getAppOrganizationId(): string | undefined {
  // Server-side: access process.env directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env;
  const orgSlugOrId = env?.APP_ORGANIZATION;
  
  if (!orgSlugOrId && typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.warn(
      "APP_ORGANIZATION environment variable is not set. " +
      "Organization role fetching will fall back to session-based role extraction."
    );
  }
  
  return orgSlugOrId;
}

/**
 * Get the organization slug or ID for client-side use
 * Checks NEXT_PUBLIC_APP_ORGANIZATION (must be set at build time for client-side access)
 * Returns undefined if not set
 * 
 * Note: For client-side organization role fetching to work, NEXT_PUBLIC_APP_ORGANIZATION
 * should be set to the same value as APP_ORGANIZATION (e.g., "wxyc" for slug or organization ID).
 * The code will automatically resolve slugs to IDs when needed.
 * If not set, the client will fall back to session-based role extraction.
 */
export function getAppOrganizationIdClient(): string | undefined {
  // Client-side: try NEXT_PUBLIC_APP_ORGANIZATION (set at build time)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publicEnv = (globalThis as typeof globalThis & { process?: { env?: { NEXT_PUBLIC_APP_ORGANIZATION?: string } } })
    .process?.env;
  const publicOrgSlugOrId = publicEnv?.NEXT_PUBLIC_APP_ORGANIZATION;
  
  return publicOrgSlugOrId;
}

/**
 * Client-side: Resolve organization slug to organization ID
 * @param organizationSlugOrId - The organization slug (e.g., "wxyc") or ID
 * @returns The organization ID, or undefined if not found
 */
async function resolveOrganizationIdClient(
  organizationSlugOrId: string
): Promise<string | undefined> {
  try {
    // First, try to find organization by slug via getFullOrganization
    const orgResult = await authClient.organization.getFullOrganization({
      query: {
        organizationSlug: organizationSlugOrId,
      },
    });

    if (orgResult.error || !orgResult.data?.id) {
      // If slug lookup fails, assume it might already be an ID
      // Return it as-is (will be validated when we try to use it)
      return organizationSlugOrId;
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
 * Client-side: Get user's role in a specific organization
 * @param userId - The user ID to look up
 * @param organizationSlugOrId - The organization slug (e.g., "wxyc") or ID
 * @returns The user's role in the organization, or undefined if not found or on error
 */
export async function getUserRoleInOrganizationClient(
  userId: string,
  organizationSlugOrId: string
): Promise<WXYCRole | undefined> {
  try {
    // Resolve slug to ID if needed
    const organizationId = await resolveOrganizationIdClient(organizationSlugOrId);
    
    if (!organizationId) {
      return undefined;
    }

    const result = await authClient.organization.listMembers({
      query: {
        organizationId,
        filterField: "userId",
        filterOperator: "eq",
        filterValue: userId,
        limit: 1,
      },
    });

    if (result.error) {
      console.error("Error fetching organization member role:", result.error);
      return undefined;
    }

    // Find the member matching the userId
    const member = result.data?.members?.find((m: any) => m.userId === userId);
    
    if (!member) {
      // User is not a member of this organization
      return undefined;
    }

    // Extract role from member object
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

/**
 * Normalize role string format (case and separator variations)
 * Converts role strings to a consistent format for our WXYCRole type
 * Handles variations in role naming (e.g., "musicDirector" vs "music_director" vs "music-director")
 * 
 * Note: This function only normalizes the format, not the role value itself.
 * The actual role mapping (e.g., "owner"/"admin" to "stationManager") is handled by mapRoleToAuthorization()
 * 
 * @param role - The role string from better-auth
 * @returns Normalized role string that matches WXYCRole format (camelCase for multi-word roles)
 */
export function normalizeRole(role: string): string {
  const normalized = role.toLowerCase().trim();
  
  // Handle our WXYC role formats - convert to camelCase
  if (normalized === "musicdirector" || normalized === "music_director" || normalized === "music-director") {
    return "musicDirector";
  }
  if (normalized === "stationmanager" || normalized === "station_manager" || normalized === "station-manager") {
    return "stationManager";
  }
  
  // Single-word roles (member, dj) - return as-is
  if (normalized === "member" || normalized === "dj") {
    return normalized;
  }
  
  // For any other role string, return the original (mapRoleToAuthorization will handle it)
  // This includes better-auth default roles like "owner", "admin", "user"
  return role;
}
