import { vi, beforeEach, afterEach, expect } from "vitest";
import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { WXYCRole } from "@wxyc/shared/auth-client/auth";
import { DEFAULT_DASHBOARD_HOME_PAGE } from "@/lib/features/application/constants";
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

// Derived from WXYCRole rather than re-listing the tiers, so a tier added or
// renamed in @wxyc/shared surfaces here as a type error instead of silently
// leaving a station role untestable.
export type ClassicPageRole = WXYCRole | "unauthenticated" | undefined;

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

/**
 * Replacement for `next/navigation`. The pages under test only call
 * `redirect()`, but replacing the module replaces it for everything the page
 * renders — and the classic pages render through `Layout/Main` ->
 * `Navigation`, whose client hooks (`usePathname`, `useRouter`,
 * `useSearchParams`) would otherwise come back undefined and throw. The
 * hook stubs keep the mock's shape matching the module graph it serves.
 */
export function classicPageAuthorityNavigationMock() {
  return {
    redirect: (url: string) => mockRedirect(url),
    usePathname: () => "/dashboard",
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
  };
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
 * a valid session but no station role (below DJ) — `requireRole` denies that
 * member to the dashboard home. Pass `"unauthenticated"` for no session at
 * all — a different exit: `requireAuth` denies it to
 * `/login?bounced=no-session` before any role resolution runs, so
 * `adminPluginRole` is meaningless there. `adminPluginRole` models a WXYC
 * tier string leaking into the unrelated better-auth admin-plugin session
 * column, which must never grant access on its own.
 */
export function setUpClassicPageAuthority(role: ClassicPageRole, adminPluginRole: string | null = null) {
  if (role === "unauthenticated") {
    mockGetSession.mockResolvedValue({ data: null, error: null });
    return;
  }
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
    // Reset (not just clear) the arrangement mocks: clearAllMocks preserves
    // persistent mockResolvedValue implementations and un-consumed *Once
    // queues, so one test's session/role arrangement would leak into the next.
    mockGetSession.mockReset();
    mockGetUserRoleInOrganization.mockReset();
    mockGetAppOrganizationId.mockReturnValue(undefined);
    mockCookiesToString.mockReturnValue("session=test-cookie");
    process.env = { ...originalEnv, NEXT_PUBLIC_DASHBOARD_HOME_PAGE: DEFAULT_DASHBOARD_HOME_PAGE };
  });

  afterEach(() => {
    process.env = originalEnv;
  });
}

/**
 * Awaits and renders the page, then asserts it was actually reached: no
 * redirect, AND every named landmark testid rendered. Checking only "no
 * redirect" passes vacuously for a page that renders nothing, so it cannot
 * distinguish "allowed and working" from "allowed and broken" — which is why
 * the signature requires at least one landmark: with none, this would
 * degenerate into exactly that vacuous absence-of-redirect check.
 */
export async function assertReachesClassicPage(page: () => Promise<ReactElement>, ...landmarkTestIds: [string, ...string[]]) {
  const result = await page();
  renderWithProviders(result);

  expect(mockRedirect).not.toHaveBeenCalled();
  for (const testId of landmarkTestIds) {
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  }
}

/**
 * Asserts the page denies access by redirecting to `destination`, which
 * defaults to the dashboard home the role gate sends an under-authorized
 * member to. `rejects.toThrow` matches on substring, so a destination that is
 * a prefix of the real one would pass on the marker alone — the exact-argument
 * assertion below is what actually pins it.
 */
export async function assertDeniedClassicPage(
  page: () => Promise<ReactElement>,
  destination: string = DEFAULT_DASHBOARD_HOME_PAGE,
) {
  await expect(page()).rejects.toThrow(`NEXT_REDIRECT:${destination}`);
  expect(mockRedirect).toHaveBeenCalledWith(destination);
}
