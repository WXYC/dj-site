import { jwtDecode } from "jwt-decode";
import { authClient, authFetch, getJWTToken } from "./client";
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
 * Resolves the configured organization slug to its UUID via the admin
 * endpoint (admin session required), caching per page session. Prefer
 * passing slugOverride from a server component prop to avoid build-time
 * inlining issues.
 */
export async function resolveOrganizationIdAdmin(slugOverride?: string): Promise<string | null> {
  const slug = slugOverride || process.env.NEXT_PUBLIC_APP_ORGANIZATION;
  if (!slug) return null;

  const cached = cachedAdminOrgIds.get(slug);
  if (cached) return cached;

  try {
    const { ok, data } = await authFetch<{ id?: string }>(
      `/admin/resolve-organization?slug=${encodeURIComponent(slug)}`,
      { method: "GET" }
    );

    if (!ok) return null;
    if (!data?.id) return null;
    cachedAdminOrgIds.set(slug, data.id);
    return data.id;
  } catch {
    return null;
  }
}

export { getAppOrganizationId, getAppOrganizationIdClient };

async function resolveOrganizationIdClient(
  organizationSlugOrId: string
): Promise<string | undefined> {
  try {
    const orgResult = await authClient.organization.getFullOrganization({
      query: {
        organizationSlug: organizationSlugOrId,
      },
    });

    if (orgResult.error) {
      // Must not fall back to treating the slug as an ID here: that would
      // silently downgrade the user to NO authority.
      console.error("Failed to resolve organization slug:", orgResult.error);
      return undefined;
    }

    if (orgResult.data?.id) {
      return orgResult.data.id;
    }

    // No error and no id: assume the input is already an organization ID.
    return organizationSlugOrId;
  } catch (error) {
    console.error("Exception resolving organization ID from slug:", error);
    // Same reasoning as the error branch above: no fallback to the raw slug.
    return undefined;
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

/** Client-side: get a user's role in a specific organization. */
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

    const member = result.data?.members?.find((m: any) => m.userId === userId);

    if (!member) {
      return undefined;
    }

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

/**
 * Normalizes case/separator variations in a role string (e.g.
 * "music_director" -> "musicDirector") to our WXYCRole format. Only the
 * format is normalized here; value mapping (e.g. "owner"/"admin" ->
 * "stationManager") is roleToAuthorization()'s job.
 */
export function normalizeRole(role: string): string {
  const normalized = role.toLowerCase().trim();

  if (normalized === "musicdirector" || normalized === "music_director" || normalized === "music-director") {
    return "musicDirector";
  }
  if (normalized === "stationmanager" || normalized === "station_manager" || normalized === "station-manager") {
    return "stationManager";
  }

  if (normalized === "member" || normalized === "dj") {
    return normalized;
  }

  // Unrecognized strings (including better-auth defaults like "owner",
  // "admin", "user") pass through for roleToAuthorization to handle.
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
