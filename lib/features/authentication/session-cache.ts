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
 * A rejected fetch (DNS, TLS, ECONNREFUSED, abort/timeout) gets exactly one
 * retry, after `transportRetryConfig.delayMs`, still inside this memoized
 * function so the retry counts as a single cache() entry. Never retried: a
 * resolved HTTP error (429, 5xx, ...) — better-auth's rate limiter does not
 * advance its bucket's clock on a denied request, so an immediate retry
 * during a burst just 429s again. If the retry also rejects, the terminal
 * `.catch` stamps `error.transport = true` so callers can tell "this never
 * reached the server" apart from a resolved, status-less error (see
 * `classifySessionRead` in ./utilities). Each attempt is measured
 * separately, so a retried call reports two `auth.getSession` lines instead
 * of one artificially combined duration.
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

export const getSessionCached = cache((cookieHeader: string) =>
  fetchSession(cookieHeader).catch(() =>
    wait(transportRetryConfig.delayMs).then(() =>
      fetchSession(cookieHeader).catch((error) => {
        // Swallow auth-server fetch errors to avoid noisy Next.js errors,
        // and model the failure honestly: casting the raw Error straight
        // into { message, code } would claim a `code` it never had.
        // Stamping `transport: true` instead is the only way a caller can
        // tell "this never reached the server" apart from a resolved,
        // status-less error (e.g. the SESSION_EXPIRED shape) — classifying
        // on an absent `status` would misclassify that shape too.
        const message = error instanceof Error ? error.message : String(error);
        return { data: null, error: { message, transport: true } } as BetterAuthSessionResponse;
      })
    )
  )
);

export const getOrgRoleCached = cache(
  (userId: string, organizationId: string | undefined, cookieHeader?: string) =>
    measure("auth.orgRole", () =>
      getUserRoleInOrganization(userId, organizationId, cookieHeader)
    )
);
