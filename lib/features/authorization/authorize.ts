import { NextRequest, NextResponse } from "next/server";
import { serverAuthClient } from "@/lib/features/authentication/server-client";
import { Authorization } from "@/lib/features/admin/types";
import { mapRoleToAuthorization } from "@/lib/features/authentication/types";
import { BetterAuthSession } from "@/lib/features/authentication/utilities";

// ============================================================================
// Branded Types for Compile-Time Authorization Enforcement
// ============================================================================

/** Brand marker for role-based authorization */
declare const RoleAuthorizedBrand: unique symbol;

/**
 * A session that has been verified to have at least a certain role.
 * The brand ensures this type can only be created through authorize().
 */
export type RoleAuthorizedSession<R extends Authorization> = {
  user: {
    id: string;
    username: string;
    email: string;
    authority: Authorization;
    name: string;
    realName?: string;
    djName?: string;
    emailVerified: boolean;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  readonly [RoleAuthorizedBrand]: R;
};

// ============================================================================
// Authorization Result Types
// ============================================================================

export type AuthorizeSuccess<R extends Authorization> = {
  ok: true;
  session: RoleAuthorizedSession<R>;
};

export type AuthorizeFailure = {
  ok: false;
  response: NextResponse;
};

export type AuthorizeResult<R extends Authorization> = AuthorizeSuccess<R> | AuthorizeFailure;

// ============================================================================
// Authorize Options
// ============================================================================

export type AuthorizeOptions<R extends Authorization> = {
  role: R;
};

// ============================================================================
// Main Authorize Function
// ============================================================================

/**
 * Authorize a request, verifying the user has the required role.
 * 
 * Returns a branded session on success, ensuring the TypeScript compiler
 * enforces that authorization was checked before accessing protected data.
 * 
 * @example
 * ```ts
 * export async function PATCH(request: NextRequest) {
 *   const auth = await authorize(request, { role: Authorization.SM });
 *   if (!auth.ok) return auth.response;
 *   
 *   // auth.session is now RoleAuthorizedSession<Authorization.SM>
 *   // TypeScript ensures we can only reach here if authorized
 *   return updateData(auth.session, await request.json());
 * }
 * ```
 */
export async function authorize<R extends Authorization>(
  request: NextRequest,
  options: AuthorizeOptions<R>
): Promise<AuthorizeResult<R>> {
  // Get cookies from request
  const cookieHeader = request.headers.get("cookie") ?? "";

  // Get session from better-auth
  let session: BetterAuthSession | null = null;
  try {
    const result = await serverAuthClient.getSession({
      fetchOptions: {
        headers: {
          cookie: cookieHeader,
        },
      },
    });
    
    if (result.error) {
      console.error("Session error:", result.error);
    }
    
    session = result.data as BetterAuthSession | null;
  } catch (error) {
    console.error("Failed to get session:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      ),
    };
  }

  // Check if authenticated
  if (!session || !session.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  // Get user's authority from their role
  const userRole = (session.user as any).role as string | undefined;
  const userAuthority = mapRoleToAuthorization(userRole);

  // Check if user has required role
  if (userAuthority < options.role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  // Create the branded session
  const authorizedSession: RoleAuthorizedSession<R> = {
    user: {
      id: session.user.id,
      username: session.user.username ?? session.user.name,
      email: session.user.email,
      authority: userAuthority,
      name: session.user.name,
      realName: session.user.realName,
      djName: session.user.djName,
      emailVerified: session.user.emailVerified,
    },
    session: {
      id: session.session.id,
      userId: session.session.userId,
      expiresAt: session.session.expiresAt,
    },
  } as RoleAuthorizedSession<R>;

  return {
    ok: true,
    session: authorizedSession,
  };
}

/**
 * Convenience function for routes that only require authentication (no specific role).
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthorizeResult<Authorization.NO>> {
  return authorize(request, { role: Authorization.NO });
}

/**
 * Convenience function for DJ-level routes.
 */
export async function requireDJ(
  request: NextRequest
): Promise<AuthorizeResult<Authorization.DJ>> {
  return authorize(request, { role: Authorization.DJ });
}

/**
 * Convenience function for Music Director routes.
 */
export async function requireMD(
  request: NextRequest
): Promise<AuthorizeResult<Authorization.MD>> {
  return authorize(request, { role: Authorization.MD });
}

/**
 * Convenience function for Station Manager routes.
 */
export async function requireSM(
  request: NextRequest
): Promise<AuthorizeResult<Authorization.SM>> {
  return authorize(request, { role: Authorization.SM });
}
