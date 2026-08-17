import { Authorization } from "../admin/types";
import {
  AuthenticationData,
  AuthenticatedUser,
  IncompleteUser,
  roleToAuthorization,
  User,
  VerifiedData
} from "./types";
import { getAppOrganizationId, getAppOrganizationIdClient } from "./organization-config";

export type BetterAuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
    username?: string;
    emailVerified: boolean;
    realName?: string;
    djName?: string;
    pronouns?: string;
    namePronunciation?: string;
    showTimes?: string;
    title?: string;
    semesterHired?: string;
    bio?: string;
    location?: string;
    appSkin?: string;
    createdAt?: Date;
    updatedAt?: Date;
    role?: string | null;  // better-auth's admin-plugin column: 'admin' | null. Never a WXYC tier.
    banned?: boolean;
    banReason?: string | null;
    banExpires?: Date | null;
    hasCompletedOnboarding?: boolean;
    displayUsername?: string | null;
    image?: string | null;
    // Organization member data (if using organizationClient)
    organization?: {
      id: string;
      name: string;
      role?: string;  // Organization member role (e.g., "member", "dj", "musicDirector", "stationManager")
    };
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token?: string;  // Session ID (not a JWT token)
    activeOrganizationId?: string | null;
  };
};

export type BetterAuthSessionResponse = {
  data: BetterAuthSession | null;
  error?: {
    message: string;
    code?: string;
    status?: number;
    statusText?: string;
    // Stamped by getSessionCached's terminal catch when the fetch itself
    // rejected (DNS, TLS, ECONNREFUSED, abort/timeout) rather than resolving
    // with an HTTP error status. Never inferred from an absent `status`: a
    // resolved, status-less error (e.g. the SESSION_EXPIRED shape below)
    // must still classify as an absent session, not an unavailable one.
    transport?: true;
  };
};

/**
 * The three outcomes a session read can resolve to. `unavailable` covers
 * "the server could not tell us whether this session is valid" — a 429 or
 * 5xx from the auth service, or a fetch that never got a response at all —
 * as distinct from `absent`, which covers a clean `data: null`, a 401/403,
 * and any other status-less resolved error: cases where the auth server is
 * confidently saying no valid session exists.
 */
export type SessionReadResult =
  | { kind: "session"; session: BetterAuthSession }
  | { kind: "absent" }
  | { kind: "unavailable"; status?: number };

/**
 * Pure classifier for a raw session-read response. Sited beside the type it
 * classifies, not in server-utils.ts, so it unit-tests with no next/headers
 * mocking, and so lib/features/session.ts — which deliberately avoids
 * server-utils.ts's redirect/cookies surface — can reuse it directly.
 *
 * Do not infer "transport" from a missing `status`: that would render an
 * unavailable-session notice, with a retry button that can never succeed,
 * for a genuinely expired or invalid session (a resolved error with no
 * `status`, e.g. the SESSION_EXPIRED shape) — the inverse of what this
 * classification exists to prevent. Classify on the explicit tag only.
 */
export function classifySessionRead(
  response: BetterAuthSessionResponse
): SessionReadResult {
  if (response.data) {
    return { kind: "session", session: response.data };
  }

  const error = response.error;

  if (error?.transport) {
    return { kind: "unavailable" };
  }

  if (error?.status !== undefined && (error.status === 429 || error.status >= 500)) {
    return { kind: "unavailable", status: error.status };
  }

  return { kind: "absent" };
}

export const defaultAuthenticationData: AuthenticationData = {
  message: "Not Authenticated",
};


/**
 * This function does not fetch organization role from APP_ORGANIZATION.
 * It only uses role data already present in the session object.
 * For proper role-based access control, use betterAuthSessionToAuthenticationDataAsync() instead.
 */
export function betterAuthSessionToAuthenticationData(
  session: BetterAuthSession | null | undefined
): AuthenticationData {
  if (!session || !session.user) {
    return { message: "Not Authenticated" };
  }

  const organizationRole = (session.user as any).organization?.role;
  const userRole = (session.user as any).role;
  const metadataRole = (session.user as any).metadata?.role;
  const customRole = (session.user as any).customRole;
  const roleToMap = organizationRole || metadataRole || customRole || userRole;

  const token = session.session?.token;
  const authority = roleToAuthorization(roleToMap);

  const username = session.user.username || session.user.name;

  // Treat undefined/absent as incomplete (`!== true`), matching server-utils.
  if (session.user.hasCompletedOnboarding !== true) {
    const missingAttributes: (keyof VerifiedData)[] = [];
    if (!session.user.realName || session.user.realName.trim() === "") {
      missingAttributes.push("realName");
    }
    // djName is optional — not included in required attributes
    return {
      username,
      requiredAttributes: missingAttributes,
    } as IncompleteUser;
  }

  const user: User = {
    id: session.user.id,
    username: username,
    email: session.user.email,
    realName: session.user.realName,
    djName: session.user.djName,
    pronouns: session.user.pronouns,
    namePronunciation: session.user.namePronunciation,
    showTimes: session.user.showTimes,
    title: session.user.title,
    semesterHired: session.user.semesterHired,
    bio: session.user.bio,
    location: session.user.location,
    authority: authority,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
    appSkin: session.user.appSkin,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };

  return {
    user,
    accessToken: token,
    token: token, // Session ID (not a JWT)
  } as AuthenticatedUser;
}

/**
 * Fetches the user's role from APP_ORGANIZATION organization for proper role-based access control.
 * Falls back to session-based role extraction if organization query fails.
 */
export async function betterAuthSessionToAuthenticationDataAsync(
  session: BetterAuthSession | null | undefined
): Promise<AuthenticationData> {
  if (!session || !session.user) {
    return { message: "Not Authenticated" };
  }

  let roleToMap: string | undefined;

  const organizationId = typeof window !== "undefined"
    ? getAppOrganizationIdClient()
    : getAppOrganizationId();

  if (organizationId && typeof window !== "undefined") {
    try {
      const { fetchOrganizationRoleForUserClient } = await import("./organization-utils");
      const orgRole = await fetchOrganizationRoleForUserClient(
        session.user.id,
        organizationId
      );

      if (orgRole !== undefined) {
        roleToMap = orgRole;
      }
    } catch (error) {
      console.warn("Failed to fetch organization role, falling back to session data:", error);
    }
  }
  // On server-side, skip organization role fetch here - server-side code should use
  // betterAuthSessionToAuthenticationData with getUserRoleInOrganization separately (as in session.ts)

  if (!roleToMap) {
    const organizationRole = (session.user as any).organization?.role;
    const userRole = (session.user as any).role;
    const metadataRole = (session.user as any).metadata?.role;
    const customRole = (session.user as any).customRole;
    roleToMap = organizationRole || metadataRole || customRole || userRole;
  }

  const token = session.session?.token;
  const authority = roleToAuthorization(roleToMap);

  const username = session.user.username || session.user.name;

  // Treat undefined/absent as incomplete (`!== true`), matching server-utils.
  if (session.user.hasCompletedOnboarding !== true) {
    const missingAttributes: (keyof VerifiedData)[] = [];
    if (!session.user.realName || session.user.realName.trim() === "") {
      missingAttributes.push("realName");
    }
    // djName is optional — not included in required attributes
    return {
      username,
      requiredAttributes: missingAttributes,
    } as IncompleteUser;
  }

  const user: User = {
    id: session.user.id,
    username: username,
    email: session.user.email,
    realName: session.user.realName,
    djName: session.user.djName,
    pronouns: session.user.pronouns,
    namePronunciation: session.user.namePronunciation,
    showTimes: session.user.showTimes,
    title: session.user.title,
    semesterHired: session.user.semesterHired,
    bio: session.user.bio,
    location: session.user.location,
    authority: authority,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
    appSkin: session.user.appSkin,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };

  return {
    user,
    accessToken: token,
    token: token, // Session ID (not a JWT)
  } as AuthenticatedUser;
}
