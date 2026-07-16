"use client";

import { ReactNode } from "react";
import { Authorization } from "@/lib/features/admin/types";
import { authClient } from "@/lib/features/authentication/client";
import { roleToAuthorization } from "@/lib/features/authentication/types";

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

  if (session.isPending) {
    return <>{loading}</>;
  }

  if (!session.data?.user) {
    return <>{fallback}</>;
  }

  const userRole = (session.data.user as any).role as string | undefined;
  const userAuthority = roleToAuthorization(userRole);

  if (userAuthority < requiredRole) {
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
