import { jwtDecode } from "jwt-decode";
import { authClient, authBaseURL, getJWTToken } from "./client";
import { getAppOrganizationId, getAppOrganizationIdClient } from "./organization-config";
import { BetterAuthJwtPayload, WXYCRole } from "./types";

/**
 * Module-level cache of organization IDs resolved via the admin endpoint,
 * keyed by slug so distinct slugs never collide (multi-org / staging-vs-prod /
 * admin-impersonation). Slug-to-ID mappings are stable so no TTL is needed;
 * the cache resets on page reload and, on logout, via resetOrganizationIdCache
 * so a departing user's resolved UUID can't leak into the next session (#616).
 */
const cachedAdminOrgIds = new Map<string, string>();

/**
 * Resolve the configured organization slug to its UUID via the admin endpoint.
 * Caches the result for the page session. For use in admin contexts only (roster,
 * role management) — requires the current user to have an admin session.
 *
 * @param slugOverride - Explicit slug to use instead of the NEXT_PUBLIC_APP_ORGANIZATION env var.
 *   Prefer passing this from a server component prop to avoid build-time inlining issues.
 * @returns The organization UUID, or null if the slug is not configured or resolution fails.
 */
export async function resolveOrganizationIdAdmin(slugOverride?: string): Promise<string | null> {
  const slug = slugOverride || process.env.NEXT_PUBLIC_APP_ORGANIZATION;
  if (!slug) return null;

  const cached = cachedAdminOrgIds.get(slug);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${authBaseURL}/admin/resolve-organization?slug=${encodeURIComponent(slug)}`,
      { credentials: "include" }
    );

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.id) return null;
    cachedAdminOrgIds.set(slug, data.id);
    return data.id;
  } catch {
    return null;
  }
}

// Re-export for existing consumers
export { getAppOrganizationId, getAppOrganizationIdClient };

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

/** Whether a normalized role string is a known WXYC org role we trust from JWT claims. */
export function isRecognizedOrganizationRole(role: string): boolean {
  switch (normalizeRole(role)) {
    case "member":
    case "dj":
    case "musicDirector":
    case "stationManager":
    case "owner":
    case "admin":
    case "user":
      return true;
    default:
      return false;
  }
}

/**
 * Read the current user's organization role from a better-auth JWT.
 * JWTs include member role for all authenticated users; organization.listMembers
 * is restricted to admins and returns nothing useful for DJs and music directors.
 */
export function organizationRoleFromJwtToken(
  token: string,
  userId: string
): WXYCRole | undefined {
  try {
    const decoded = jwtDecode<BetterAuthJwtPayload>(token);
    if (typeof decoded.exp === "number" && decoded.exp * 1000 <= Date.now()) {
      return undefined;
    }
    const tokenUserId = decoded.id || decoded.sub;
    if (!tokenUserId || tokenUserId !== userId || !decoded.role) {
      return undefined;
    }
    if (!isRecognizedOrganizationRole(decoded.role)) {
      return undefined;
    }
    return normalizeRole(decoded.role) as WXYCRole;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the current user's organization role on the client.
 * Prefers the JWT (available to every authenticated member); falls back to
 * organization.listMembers when a slug/id is provided (admin-only in practice).
 */
export async function fetchOrganizationRoleForUserClient(
  userId: string,
  organizationSlugOrId?: string
): Promise<WXYCRole | undefined> {
  const jwtToken = await getJWTToken();
  if (jwtToken) {
    const jwtRole = organizationRoleFromJwtToken(jwtToken, userId);
    if (jwtRole) {
      return jwtRole;
    }
  }

  if (!organizationSlugOrId) {
    return undefined;
  }

  return getUserRoleInOrganizationClient(userId, organizationSlugOrId);
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
    const jwtToken = await getJWTToken();
    if (jwtToken) {
      const jwtRole = organizationRoleFromJwtToken(jwtToken, userId);
      if (jwtRole) {
        return jwtRole;
      }
    }

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
 * The actual role mapping (e.g., "owner"/"admin" to "stationManager") is handled by roleToAuthorization()
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

  // For any other role string, return the original (roleToAuthorization will handle it)
  // This includes better-auth default roles like "owner", "admin", "user"
  return role;
}

/**
 * Clear the admin org-id cache. Wired into the logout flow (resetApplication)
 * so a departing user's resolved organization UUID can't leak into the next
 * session on the same browser (#616).
 */
export function resetOrganizationIdCache() {
  cachedAdminOrgIds.clear();
}

/** @internal — test-only alias of {@link resetOrganizationIdCache}. */
export const _resetOrgCacheForTesting = resetOrganizationIdCache;
