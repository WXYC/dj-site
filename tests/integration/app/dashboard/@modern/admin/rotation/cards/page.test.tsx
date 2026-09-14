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
// "reached" here. notFound() carries the same shape for the flag gate.
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  notFound: () => mockNotFound(),
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

// The page's own responsibility under test is the flag + auth gate, not the
// header chrome.
vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

import RotationCardsPage from "@/app/dashboard/@modern/admin/rotation/cards/page";

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

describe("rotation cards page", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // vi.clearAllMocks() clears call history but not a configured
    // mockResolvedValue, so it's reset explicitly rather than relying on
    // every test below to set one before use.
    mockGetUserRoleInOrganization.mockReset();
    mockGetAppOrganizationId.mockReturnValue(undefined);
    mockCookiesToString.mockReturnValue("session=test-cookie");
    // Pinned so the redirect destination asserted below is deterministic —
    // requireRole falls back to DEFAULT_DASHBOARD_HOME_PAGE otherwise, which
    // would make the assertion depend on the ambient environment.
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard",
      NEXT_PUBLIC_ROTATION_ADMIN_ENABLED: "true",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reaches the page for a music director", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue("musicDirector");

    const result = await RotationCardsPage();
    renderWithProviders(result);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("still reaches the page for a station manager", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue("stationManager");

    const result = await RotationCardsPage();
    renderWithProviders(result);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects a DJ away", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue("dj");

    await expect(RotationCardsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData("musicDirector"), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue(undefined);

    await expect(RotationCardsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("404s before any session read when the rotation admin flag is off", async () => {
    delete process.env.NEXT_PUBLIC_ROTATION_ADMIN_ENABLED;
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue("musicDirector");

    await expect(RotationCardsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
    // Flag-off is a 404 for everyone — the dark launch must not depend on
    // who is asking, so the auth read is never even attempted.
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});
