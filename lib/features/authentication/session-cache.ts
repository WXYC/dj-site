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
 */
export const getSessionCached = cache((cookieHeader: string) =>
  measure("auth.getSession", () =>
    serverAuthClient
      .getSession({
        fetchOptions: {
          headers: { cookie: cookieHeader },
        },
      })
      .catch((error) => {
        // Swallow auth-server fetch errors to avoid noisy Next.js errors.
        return { data: null, error } as BetterAuthSessionResponse;
      })
  )
);

export const getOrgRoleCached = cache(
  (userId: string, organizationId: string | undefined, cookieHeader?: string) =>
    measure("auth.orgRole", () =>
      getUserRoleInOrganization(userId, organizationId, cookieHeader)
    )
);
