import { cache } from "react";
import { serverAuthClient } from "./server-client";
import { getUserRoleInOrganization } from "./organization-utils.server";
import { BetterAuthSessionResponse } from "./utilities";
import { measure } from "@/lib/server-timing";

/**
 * Per-request cached raw auth fetches. React `cache()` memoizes within a single
 * RSC request, so the several session/org-role reads a dashboard render performs
 * — `createServerSideProps` (root layout + `ThemedLayout`), `requireAuth` in the
 * dashboard layout, and `requireAuth` + `getUserFromSession` in Leftbar —
 * collapse to one backend round-trip each instead of ~3× getSession / ~2×
 * org-role.
 *
 * Cached at the RAW fetch seam, not a normalized result: the callers normalize
 * divergently (`session.ts` maps role/banned/appSkin/authority; `getServerSession`
 * maps only `username`) and the org-role feeds authentication data in one path
 * vs the fail-closed `Authorization` enum in `getUserAuthority` — sharing a
 * normalized value would flatten those. The `measure()` wrapper keeps the
 * `[server_timing]` per-phase logging on the deduped call.
 *
 * Keyed on the cookie header (session) and user+org+cookie (role); within one
 * request those are constant, so each resolves to a single fetch.
 *
 * Two caller invariants this relies on:
 *  - The memoized result is SHARED by reference across callers in a request —
 *    treat it as read-only. Today's callers (`getServerSession`,
 *    `createServerSideProps`) spread-copy `session.data` before normalizing, so
 *    they never mutate the shared object; new callers must do the same.
 *  - Pass a CONSISTENT `cookieHeader` for the same user within a request. It is
 *    part of the role key, so a caller that omitted it (`undefined`) while
 *    another passed the string would key differently and lose the dedup (a
 *    redundant round-trip — correctness is still preserved). Every current
 *    call site resolves a concrete header, so they collide on one key.
 *
 * A rejected fetch (DNS, TLS, ECONNREFUSED, a timeout) gets exactly one
 * retry, after `transportRetryConfig.delayMs`, still inside this memoized
 * function so the retry counts as a single cache() entry. Never retried: a
 * resolved HTTP error (429, 5xx, ...) — better-auth's rate limiter does not
 * advance its bucket's clock on a denied request, so an immediate retry
 * during a burst just 429s again — and an aborted fetch (`error.name ===
 * "AbortError"`, e.g. the client disconnected mid-render), since retrying
 * that would issue a second request to an already-degraded auth service on
 * behalf of a caller no longer there to receive it. Both non-retried cases
 * still resolve through the same terminal handling as a retry that itself
 * rejects: the failure stamps `error.transport = true` so callers can tell
 * "this never reached the server" apart from a resolved, status-less error
 * (see `classifySessionRead` in ./utilities). Each attempt is measured
 * separately, so a retried call reports two `auth.getSession` lines instead
 * of one artificially combined duration.
 *
 * The retry is unconditional on rejection (short of an abort), which bounds
 * every render that reaches this seam at two connect timeouts plus the delay
 * — the auth client sets no fetch timeout of its own, so that ceiling is the
 * platform's, and against a blackholed connection it is twice what a single
 * attempt would cost. That scope is wider than the dashboard: this seam is
 * also reached from `createServerSideProps` (session.ts), which the ROOT
 * layout calls on every route. Against a blackholed auth host, every page —
 * `/`, `/live`, `/login`, anonymous traffic included, not just an
 * authenticated dashboard render — pays the same two timeouts plus the
 * delay. That is an accepted trade for recovering the common transient
 * rejection; if the runtime's timeout ever rises far enough to threaten the
 * response budget, bound this by rejection kind rather than lengthening the
 * delay.
 */

/**
 * Delay before the single transport-rejection retry above. A plain object,
 * not a bare exported constant: an exported `let` binding is read-only from
 * an importing module (reassigning it is a compile error), so a test
 * overrides `.delayMs` directly instead of waiting out a real delay. Must
 * stay module-scope and never become a `getSessionCached` parameter — every
 * argument is part of the memo key above, and a delay defaulted differently
 * by two call sites would silently split it and reintroduce the extra
 * round-trip this seam exists to eliminate.
 */
export const transportRetryConfig = { delayMs: 250 };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchSession(cookieHeader: string): Promise<BetterAuthSessionResponse> {
  // better-fetch's resolved shape is structurally close to but not exactly
  // BetterAuthSessionResponse (e.g. `username` is `string | null |
  // undefined` there, `string | undefined` here) — every caller downstream
  // already narrows on that boundary (see `normalizeSession` in
  // server-session.ts), so this cast keeps the seam's exported type honest
  // in one place instead of scattering casts across every consumer.
  return measure("auth.getSession", () =>
    serverAuthClient.getSession({
      fetchOptions: {
        headers: { cookie: cookieHeader },
      },
    })
  ) as Promise<BetterAuthSessionResponse>;
}

// Fetch rejections arrive as DOMException (an abort) or Error (everything
// else), and DOMException's inheritance from Error is not consistent enough
// across runtimes to branch on `instanceof Error` — duck-type both checks on
// the properties actually being asked about instead.
function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

// Swallow auth-server fetch errors to avoid noisy Next.js errors, and model
// the failure honestly: casting the raw Error straight into { message, code }
// would claim a `code` it never had. Stamping `transport: true` instead is
// the only way a caller can tell "this never reached the server" apart from
// a resolved, status-less error (e.g. the SESSION_EXPIRED shape) —
// classifying on an absent `status` would misclassify that shape too.
function transportFailure(error: unknown): BetterAuthSessionResponse {
  const message =
    typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error);
  return { data: null, error: { message, transport: true } } as BetterAuthSessionResponse;
}

export const getSessionCached = cache((cookieHeader: string) =>
  fetchSession(cookieHeader).catch((error) => {
    if (isAbortError(error)) {
      // The client disconnected mid-render, aborting the in-flight fetch.
      // Retrying would issue a second request to an auth service that may
      // already be degraded, on behalf of a caller no longer there to
      // receive the answer — skip straight to the terminal shape instead.
      return transportFailure(error);
    }
    return wait(transportRetryConfig.delayMs).then(() =>
      fetchSession(cookieHeader).catch(transportFailure)
    );
  })
);

export const getOrgRoleCached = cache(
  (userId: string, organizationId: string | undefined, cookieHeader?: string) =>
    measure("auth.orgRole", () =>
      getUserRoleInOrganization(userId, organizationId, cookieHeader)
    )
);
