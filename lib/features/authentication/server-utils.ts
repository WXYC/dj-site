import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BetterAuthSession } from "./utilities";
import { Authorization } from "../admin/types";
import { roleToAuthorization, VerifiedData } from "./types";
import { getAppOrganizationId } from "./organization-utils.server";
import { getOrgRoleCached } from "./session-cache";
import { getServerSessionResult } from "./server-session";
import { DEFAULT_DASHBOARD_HOME_PAGE } from "@/lib/features/application/constants";

export { getServerSession } from "./server-session";

/**
 * Non-redirecting counterpart to `requireAuth`, for the one caller that
 * needs to render something in place of a failed session read instead of
 * bouncing to `/login`: the dashboard layout. On `absent` it redirects
 * exactly as `requireAuth` does (the cookie is genuinely missing or
 * invalid), and it keeps the existing `email-not-verified` / `incomplete`
 * exits. On `unavailable` (rate limited, upstream 5xx, or a transport
 * failure) it returns `{ ok: false }` instead — the caller decides what to
 * render, because redirecting here would sign a DJ out mid-show for a
 * transient auth-server problem while their cookie is still perfectly
 * valid.
 *
 * Named `resolve*`, deliberately not `requireAuthOrUnavailable`: `checkRole`
 * below is this file's one other non-redirecting check, and every
 * `require*`-prefixed function in this module always redirects. This is the
 * sole gate in front of every dashboard route — the worst possible place
 * for a `require*`-prefixed function to invert that contract by returning
 * instead of redirecting.
 */
export async function resolveAuthGate(): Promise<
  { ok: true; session: BetterAuthSession } | { ok: false; status?: number }
> {
  const result = await getServerSessionResult();

  if (result.kind === "unavailable") {
    return { ok: false, status: result.status };
  }

  if (result.kind === "absent") {
    redirect("/login?bounced=no-session");
  }

  const session = result.session;

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

  return { ok: true, session };
}

/**
 * Redirects to login if unauthenticated, email-unverified, or the session
 * read failed to resolve; otherwise returns the session. Page-level callers
 * have no notice surface of their own, so a failed read (`unavailable`)
 * degrades to the same "no session" bounce here — only the dashboard
 * layout, via `resolveAuthGate` directly, distinguishes it and renders a
 * retry notice instead.
 *
 * Each exit carries a server-only `bounced` param so the client can emit a
 * `login_server_bounce` PostHog event — the server's VERDICT, distinct from
 * the client's post-login redirect INTENT (`login_post_redirect`): a DJ can
 * be told "login successful" client-side and still get bounced here when the
 * session cookie isn't valid server-side.
 */
export async function requireAuth(): Promise<BetterAuthSession> {
  const gate = await resolveAuthGate();
  if (!gate.ok) {
    redirect("/login?bounced=no-session");
  }

  return gate.session;
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

/**
 * Non-redirecting permission check.
 *
 * `cookieHeader` is required, not optional: it is the only way
 * `getUserAuthority` can reach the JWT, and with APP_ORGANIZATION unset in
 * every environment (the normal case), an omitted header leaves no other
 * role source — resolution fails closed to NO for every caller, silently.
 * Callers that don't have a header to hand should fetch one (see
 * `requireRole` below) rather than pass a fallback string here.
 */
export async function checkRole(session: BetterAuthSession, requiredRole: Authorization, cookieHeader: string): Promise<boolean> {
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
