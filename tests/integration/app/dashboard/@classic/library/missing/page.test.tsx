import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders } from "@/tests/helpers";

vi.mock("server-only", () => ({}));

const mockCookiesToString = vi.fn(() => "session=test-cookie");
vi.mock("next/headers", () => ({
  cookies: () => ({ toString: mockCookiesToString }),
}));

// A real redirect() call inside a streaming server component resolves with
// HTTP 200 and a NEXT_REDIRECT marker in the body, not a 307 — asserting on
// that marker (not a status code) is what actually distinguishes "gated" from
// "reached" here.
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

const mockGetSession = vi.fn();
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: (options: unknown) => mockGetSession(options),
  },
}));

// Reproduces the deployed shape: APP_ORGANIZATION is unset, so the only role
// source is the JWT-first resolver this mock stands in for.
const mockGetUserRoleInOrganization = vi.fn();
const mockGetAppOrganizationId = vi.fn(() => undefined);
vi.mock("@/lib/features/authentication/organization-utils.server", () => ({
  getUserRoleInOrganization: (userId: string, orgId: string | undefined, cookie?: string) =>
    mockGetUserRoleInOrganization(userId, orgId, cookie),
  getAppOrganizationId: () => mockGetAppOrganizationId(),
}));

// The page's own responsibility under test is the auth gate, not the RTK
// Query-backed table content or the shared classic nav bar.
vi.mock("@/src/components/experiences/classic/library/MissingReleases", () => ({
  default: () => <div data-testid="missing-releases-table" />,
}));
vi.mock("@/src/components/experiences/classic/Navigation", () => ({
  default: () => <nav data-testid="classic-nav" />,
}));

import ClassicMissingReleasesPage from "@/app/dashboard/@classic/library/missing/page";

function sessionData(role: string | null) {
  return {
    user: {
      id: "user-1",
      email: "dj@wxyc.org",
      name: "Test User",
      username: "testuser",
      // better-auth's admin-plugin column — never the WXYC tier under test.
      role,
      emailVerified: true,
      hasCompletedOnboarding: true,
    },
    session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
  };
}

// This screen is the one triage flagged as most likely to be "tightened" to
// MD by a well-meaning later change (dj-site#1073, PR #1082 was closed as
// exactly that regression) — asserting a plain DJ reaches it is the point of
// this test, not incidental coverage.
describe("Classic /dashboard/library/missing page — missingReleases.jsp, DJ-accessible not MD-gated", () => {
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

  it("reaches the page for a plain DJ session — the non-negotiable authority constraint", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue("dj");

    const result = await ClassicMissingReleasesPage();
    renderWithProviders(result);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("still reaches the page for a music director", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue("musicDirector");

    const result = await ClassicMissingReleasesPage();
    renderWithProviders(result);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects a member with no station role (below DJ)", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue(undefined);

    await expect(ClassicMissingReleasesPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData("musicDirector"), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue(undefined);

    await expect(ClassicMissingReleasesPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
