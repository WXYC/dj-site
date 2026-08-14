import { vi, beforeEach, afterEach, expect } from "vitest";
import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderWithProviders } from "./render";

/**
 * Shared mock preamble + assertions for the classic dashboard page-authority
 * tests (`tests/integration/app/dashboard/@classic/**`). Every one of those
 * pages runs the same `requireAuth()` -> `requireRole()` gate in front of
 * screen-specific content, so the server-session/role/flag mock stack and the
 * "did it actually render" assertions are identical across pages -- only the
 * required role, the granted role(s), and the rendered landmark differ.
 *
 * `vi.mock` factories cannot close over statically-imported bindings (see
 * `auth-client-mock.ts`), so pull the mock-shape functions in by path inside
 * each factory:
 *
 * ```ts
 * vi.mock("next/headers", async () => {
 *   const { classicPageAuthorityHeadersMock } = await import(
 *     "@/tests/helpers/classic-page-authority-harness"
 *   );
 *   return classicPageAuthorityHeadersMock();
 * });
 * ```
 */

export type ClassicPageRole = "dj" | "musicDirector" | "stationManager" | undefined;

export const mockCookiesToString = vi.fn(() => "session=test-cookie");

// A real redirect() call inside a streaming server component resolves with
// HTTP 200 and a NEXT_REDIRECT marker in the body, not a 307 -- asserting on
// that marker (not a status code) is what actually distinguishes "gated" from
// "reached" here.
export const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

export const mockGetSession = vi.fn();
export const mockGetUserRoleInOrganization = vi.fn();
export const mockGetAppOrganizationId = vi.fn(() => undefined);

/** Replacement for `next/headers`. */
export function classicPageAuthorityHeadersMock() {
  return { cookies: () => ({ toString: mockCookiesToString }) };
}

/** Replacement for `next/navigation`. */
export function classicPageAuthorityNavigationMock() {
  return { redirect: (url: string) => mockRedirect(url) };
}

/** Replacement for `@/lib/features/authentication/server-client`. */
export function classicPageAuthorityServerClientMock() {
  return {
    serverAuthClient: {
      getSession: (options: unknown) => mockGetSession(options),
    },
  };
}

/**
 * Replacement for `@/lib/features/authentication/organization-utils.server`.
 * Reproduces the deployed shape: APP_ORGANIZATION is unset, so the only role
 * source is the JWT-first resolver this mock stands in for.
 */
export function classicPageAuthorityOrganizationUtilsMock() {
  return {
    getUserRoleInOrganization: (userId: string, orgId: string | undefined, cookie?: string) =>
      mockGetUserRoleInOrganization(userId, orgId, cookie),
    getAppOrganizationId: () => mockGetAppOrganizationId(),
  };
}

function classicPageSessionData(adminPluginRole: string | null) {
  return {
    user: {
      id: "user-1",
      email: "dj@wxyc.org",
      name: "Test User",
      username: "testuser",
      // better-auth's admin-plugin column -- never the WXYC tier under test.
      role: adminPluginRole,
      emailVerified: true,
      hasCompletedOnboarding: true,
    },
    session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
  };
}

/**
 * Arranges the session/role mocks for one authority scenario. `role` is the
 * WXYC tier the org-role resolver returns; pass `undefined` for a member with
 * no station role (below DJ) or a fully unauthenticated JWT. `adminPluginRole`
 * models a WXYC tier string leaking into the unrelated better-auth
 * admin-plugin session column, which must never grant access on its own.
 */
export function setUpClassicPageAuthority(role: ClassicPageRole, adminPluginRole: string | null = null) {
  mockGetSession.mockResolvedValue({ data: classicPageSessionData(adminPluginRole), error: null });
  mockGetUserRoleInOrganization.mockResolvedValue(role);
}

/**
 * Registers the beforeEach/afterEach that reset the classic-page-authority
 * mocks and pin `NEXT_PUBLIC_DASHBOARD_HOME_PAGE` so redirect assertions are
 * deterministic -- `requireRole` falls back to `DEFAULT_DASHBOARD_HOME_PAGE`
 * otherwise, which would make the assertion depend on the ambient
 * environment. Call once inside each page's `describe` block.
 */
export function setUpClassicPageAuthorityEnv() {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserRoleInOrganization.mockReset();
    mockGetAppOrganizationId.mockReturnValue(undefined);
    mockCookiesToString.mockReturnValue("session=test-cookie");
    process.env = { ...originalEnv, NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });
}

/**
 * Awaits and renders the page, then asserts it was actually reached: no
 * redirect, AND every named landmark testid rendered. Checking only "no
 * redirect" passes vacuously for a page that renders nothing, so it cannot
 * distinguish "allowed and working" from "allowed and broken".
 */
export async function assertReachesClassicPage(page: () => Promise<ReactElement>, ...landmarkTestIds: string[]) {
  const result = await page();
  renderWithProviders(result);

  expect(mockRedirect).not.toHaveBeenCalled();
  for (const testId of landmarkTestIds) {
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  }
}

/** Asserts the page denies access by redirecting to `destination`. */
export async function assertDeniedClassicPage(page: () => Promise<ReactElement>, destination = "/dashboard") {
  await expect(page()).rejects.toThrow(`NEXT_REDIRECT:${destination}`);
  expect(mockRedirect).toHaveBeenCalledWith(destination);
}
