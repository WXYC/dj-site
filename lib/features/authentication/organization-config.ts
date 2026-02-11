/**
 * Organization environment configuration.
 * Pure functions with no server-side dependencies — safe for client and server use.
 */

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
