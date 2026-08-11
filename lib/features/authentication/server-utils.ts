import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BetterAuthSession } from "./utilities";
import { Authorization } from "../admin/types";
import { roleToAuthorization, VerifiedData } from "./types";
import { getAppOrganizationId } from "./organization-utils.server";
import { getSessionCached, getOrgRoleCached } from "./session-cache";
import { DEFAULT_DASHBOARD_HOME_PAGE } from "@/lib/features/application/constants";

/** Gets the current session from better-auth in a server component. */
export async function getServerSession(): Promise<BetterAuthSession | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const session = await getSessionCached(cookieHeader);

  if (!session.data) {
    return null;
  }

  const normalizedSession = {
    ...session.data,
    user: {
      ...session.data.user,
      username: session.data.user.username ?? undefined,
    },
  } as BetterAuthSession;

  return normalizedSession;
}

/**
 * Redirects to login if unauthenticated or email-unverified; otherwise
 * returns the session.
 *
 * Each exit carries a server-only `bounced` param so the client can emit a
 * `login_server_bounce` PostHog event — the server's VERDICT, distinct from
 * the client's post-login redirect INTENT (`login_post_redirect`): a DJ can
 * be told "login successful" client-side and still get bounced here when the
 * session cookie isn't valid server-side.
 */
export async function requireAuth(): Promise<BetterAuthSession> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?bounced=no-session");
  }

  if (!session.user.emailVerified) {
    redirect("/login?error=email-not-verified&bounced=email-not-verified");
  }

  // No OIDC authorize params on this redirect: doesn't strand a "Sign in
  // with WXYC" round-trip (#836 AC2) because an authorize bounce targets
  // `/login` directly, and neither incomplete-user render path there (login
  // layout, `app/onboarding/**`) gates through `requireAuth()` — the client
  // preserves the resume target in the `/login` URL instead.
  if (isUserIncomplete(session)) {
    redirect("/login?incomplete=true&bounced=incomplete");
  }

  return session;
}

/**
 * Extracts the user's WXYC tier from the auth JWT, unconditionally — that is
 * the only credential that reliably carries it. `session.user.role` is
 * better-auth's admin-plugin column ('admin' | null); it is a different axis
 * from the WXYC tier and is never read here, even to justify SM for an
 * admin. APP_ORGANIZATION, when configured, is consulted only as a fallback
 * for the `listMembers` lookup when the JWT is absent or carries no
 * recognized role — it is not a branch condition, so this resolves
 * correctly whether or not APP_ORGANIZATION is set. Any resolution failure
 * (no JWT claim, no org membership, a thrown error) fails closed to NO.
 */
async function getUserAuthority(session: BetterAuthSession, cookieHeader?: string): Promise<Authorization> {
  const organizationId = getAppOrganizationId();

  try {
    const orgRole = await getOrgRoleCached(session.user.id, organizationId, cookieHeader);

    if (orgRole !== undefined) {
      return roleToAuthorization(orgRole);
    }
  } catch (error) {
    console.warn("Failed to resolve WXYC role from JWT/organization membership; failing closed to NO authority:", error);
  }

  return Authorization.NO;
}

/** Non-redirecting permission check. */
export async function checkRole(session: BetterAuthSession, requiredRole: Authorization, cookieHeader?: string): Promise<boolean> {
  const userAuthority = await getUserAuthority(session, cookieHeader);

  // Authorization is an ordered enum (SM > MD > DJ > NO); the user must meet
  // or exceed the required role.
  return userAuthority >= requiredRole;
}

/** Redirects to dashboard home if the session lacks `requiredRole`. */
export async function requireRole(session: BetterAuthSession, requiredRole: Authorization, cookieHeader?: string): Promise<void> {
  const cookieStore = await cookies();
  const header = cookieHeader || cookieStore.toString();

  if (!(await checkRole(session, requiredRole, header))) {
    redirect(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || DEFAULT_DASHBOARD_HOME_PAGE));
  }
}

/**
 * Check if user has not completed onboarding (setting their own password and confirming profile).
 * Uses the explicit hasCompletedOnboarding flag rather than inspecting profile fields,
 * so admins can pre-fill realName/djName without bypassing onboarding.
 */
export function isUserIncomplete(session: BetterAuthSession): boolean {
  return session.user.hasCompletedOnboarding !== true;
}

export function getIncompleteUserAttributes(session: BetterAuthSession): (keyof VerifiedData)[] {
  const missingAttributes: (keyof VerifiedData)[] = [];

  if (!session.user.realName || session.user.realName.trim() === "") {
    missingAttributes.push("realName");
  }

  // djName is optional — not included in required attributes

  return missingAttributes;
}

export async function getUserFromSession(session: BetterAuthSession, cookieHeader?: string) {
  const token = session.session?.token;
  const cookieStore = await cookies();
  const header = cookieHeader || cookieStore.toString();
  const userAuthority = await getUserAuthority(session, header);

  const result = {
    id: session.user.id,
    username: session.user.username || session.user.name,
    email: session.user.email,
    realName: session.user.realName || undefined,
    djName: session.user.djName || undefined,
    authority: userAuthority,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
    appSkin: session.user.appSkin,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };

  return result;
}
