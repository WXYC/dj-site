"use client";

import { ReactNode } from "react";
import { Authorization } from "@/lib/features/admin/types";
import { authClient } from "@/lib/features/authentication/client";
import { mapRoleToAuthorization } from "@/lib/features/authentication/types";

// ============================================================================
// Types
// ============================================================================

export interface AuthorizedViewProps {
  /** The minimum role required to view the children */
  requiredRole: Authorization;
  /** Content to render when authorized */
  children: ReactNode;
  /** Content to render when not authorized (optional) */
  fallback?: ReactNode;
  /** Content to render while checking authorization (optional) */
  loading?: ReactNode;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Conditionally renders children based on user's authorization level.
 * 
 * Uses the current session from better-auth to check if the user
 * has the required role.
 * 
 * @example
 * ```tsx
 * <AuthorizedView requiredRole={Authorization.SM} fallback={<AccessDenied />}>
 *   <AdminPanel />
 * </AuthorizedView>
 * ```
 */
export function AuthorizedView({
  requiredRole,
  children,
  fallback = null,
  loading = null,
}: AuthorizedViewProps) {
  const session = authClient.useSession();

  // Show loading state while session is being fetched
  if (session.isPending) {
    return <>{loading}</>;
  }

  // Check if user is authenticated
  if (!session.data?.user) {
    return <>{fallback}</>;
  }

  // Get user's authorization level
  const userRole = (session.data.user as any).role as string | undefined;
  const userAuthority = mapRoleToAuthorization(userRole);

  // Check if user has required role
  if (userAuthority < requiredRole) {
    return <>{fallback}</>;
  }

  // User is authorized
  return <>{children}</>;
}

// ============================================================================
// Convenience Components
// ============================================================================

type ConvenienceProps = Omit<AuthorizedViewProps, "requiredRole">;

/**
 * Require DJ role or higher to view content.
 */
export function RequireDJ(props: ConvenienceProps) {
  return <AuthorizedView requiredRole={Authorization.DJ} {...props} />;
}

/**
 * Require Music Director role or higher to view content.
 */
export function RequireMD(props: ConvenienceProps) {
  return <AuthorizedView requiredRole={Authorization.MD} {...props} />;
}

/**
 * Require Station Manager role or higher to view content.
 */
export function RequireSM(props: ConvenienceProps) {
  return <AuthorizedView requiredRole={Authorization.SM} {...props} />;
}

/**
 * Require Admin role to view content.
 */
export function RequireAdmin(props: ConvenienceProps) {
  return <AuthorizedView requiredRole={Authorization.ADMIN} {...props} />;
}

// ============================================================================
// Exports
// ============================================================================

export default AuthorizedView;
