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
  (userId: string, organizationId: string, cookieHeader?: string) =>
    measure("auth.orgRole", () =>
      getUserRoleInOrganization(userId, organizationId, cookieHeader)
    )
);
