"use client";

import { ReactNode, useEffect, useState } from "react";
import { Authorization } from "@/lib/features/admin/types";
import { authClient } from "@/lib/features/authentication/client";
import { roleToAuthorization } from "@/lib/features/authentication/types";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import { getAppOrganizationIdClient } from "@/lib/features/authentication/organization-config";

export interface AuthorizedViewProps {
  requiredRole: Authorization;
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

export function AuthorizedView({
  requiredRole,
  children,
  fallback = null,
  loading = null,
}: AuthorizedViewProps) {
  const session = authClient.useSession();
  const userId = session.data?.user?.id as string | undefined;

  // Resolved authority is keyed to the userId it was computed for: on a live
  // session identity swap the stale value must not paint the old user's
  // privileges for even one render, so a key mismatch reads as unresolved.
  const [resolved, setResolved] = useState<
    { forUserId: string; authority: Authorization } | undefined
  >(undefined);

  useEffect(() => {
    if (!userId) {
      setResolved(undefined);
      return;
    }

    // session.data.user.role is better-auth's admin-plugin column (only ever
    // "admin" or null on this app) — it is NOT the WXYC tier and must never be
    // trusted here. The WXYC tier reaches the client only via the auth JWT.
    // fetchOrganizationRoleForUserClient decodes that JWT unconditionally and
    // only needs an organizationId for its listMembers fallback, so this
    // resolves correctly whether or not NEXT_PUBLIC_APP_ORGANIZATION is set
    // in this build (it currently isn't, in production). An unresolved role
    // — no JWT claim and no org membership — fails closed to NO.
    //
    // No extra caching is added here: getJWTToken (client.ts) already caches
    // the token with a TTL and coalesces concurrent in-flight requests, so
    // multiple AuthorizedView instances mounted on one panel share the same
    // underlying fetch and only pay for a cheap synchronous JWT decode each.
    const organizationId = getAppOrganizationIdClient();
    let cancelled = false;
    fetchOrganizationRoleForUserClient(userId, organizationId)
      .then((orgRole) => {
        if (cancelled) return;
        setResolved({
          forUserId: userId,
          authority:
            orgRole !== undefined
              ? roleToAuthorization(orgRole)
              : Authorization.NO,
        });
      })
      .catch(() => {
        if (!cancelled) setResolved({ forUserId: userId, authority: Authorization.NO });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const authority =
    userId && resolved?.forUserId === userId ? resolved.authority : undefined;

  if (session.isPending) {
    return <>{loading}</>;
  }

  if (!session.data?.user) {
    return <>{fallback}</>;
  }

  if (authority === undefined) {
    return <>{loading}</>;
  }

  if (authority < requiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

type ConvenienceProps = Omit<AuthorizedViewProps, "requiredRole">;

export function RequireDJ(props: ConvenienceProps) {
  return <AuthorizedView requiredRole={Authorization.DJ} {...props} />;
}

export function RequireMD(props: ConvenienceProps) {
  return <AuthorizedView requiredRole={Authorization.MD} {...props} />;
}

export function RequireSM(props: ConvenienceProps) {
  return <AuthorizedView requiredRole={Authorization.SM} {...props} />;
}

export default AuthorizedView;
