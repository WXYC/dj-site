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
  const rawRole = (session.data?.user as any)?.role as string | undefined;

  // Resolved authority is keyed to the userId it was computed for: on a live
  // session identity swap the stale value must not paint the old user's
  // privileges for even one render, so a key mismatch reads as unresolved.
  // When an organization is configured, authority is org-scoped and fails
  // closed to NO — the session base role is never trusted (mirrors
  // getUserAuthority in server-utils.ts).
  const [resolved, setResolved] = useState<
    { forUserId: string; authority: Authorization } | undefined
  >(undefined);

  useEffect(() => {
    if (!userId) {
      setResolved(undefined);
      return;
    }

    // NEXT_PUBLIC_APP_ORGANIZATION must be set wherever the server sets
    // APP_ORGANIZATION (organization-config.ts documents the pairing): if the
    // server is org-scoped and this is unset, this branch trusts the raw
    // session role while the server fails closed — the client would show UI
    // the server denies.
    const organizationId = getAppOrganizationIdClient();
    if (!organizationId) {
      setResolved({ forUserId: userId, authority: roleToAuthorization(rawRole) });
      return;
    }

    let cancelled = false;
    fetchOrganizationRoleForUserClient(userId, organizationId)
      .then((orgRole) => {
        if (cancelled) return;
        // An unresolved org role (not a member, or a transient failure) fails
        // closed to NO rather than falling back to the raw session role.
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
  }, [userId, rawRole]);

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
