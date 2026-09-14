import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

vi.mock("server-only", () => ({}));

const mockCookiesToString = vi.fn(() => "session=test-cookie");
vi.mock("next/headers", () => ({
  cookies: () => ({ toString: mockCookiesToString }),
}));

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

// Under test is the layout's own gate, not the tab strip's rendering — that
// has its own component tests.
vi.mock("@/src/components/experiences/modern/admin/rotation/RotationTabs", () => ({
  default: () => <div data-testid="rotation-tabs" />,
}));

import RotationAdminLayout from "@/app/dashboard/@modern/admin/rotation/layout";

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

// The layout gate exists as render-safety: it flushes to the stream before
// any page gate resolves, so it must never emit the tab strip for a
// requester the pages would reject. These cases pin exactly that — the
// pages' own gates remain the authority and are tested per page.
describe("rotation admin layout", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserRoleInOrganization.mockReset();
    mockGetAppOrganizationId.mockReturnValue(undefined);
    mockCookiesToString.mockReturnValue("session=test-cookie");
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_DASHBOARD_HOME_PAGE: "/dashboard",
      NEXT_PUBLIC_ROTATION_ADMIN_ENABLED: "true",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders the tab strip and children for a music director", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue("musicDirector");

    const result = await RotationAdminLayout({ children: <div data-testid="child-page" /> });
    renderWithProviders(result);

    expect(screen.getByTestId("rotation-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("child-page")).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects a DJ before the tab strip can render", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue("dj");

    await expect(
      RotationAdminLayout({ children: <div data-testid="child-page" /> })
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("never grants access from the admin-plugin role column, even when it holds a WXYC tier string", async () => {
    mockGetSession.mockResolvedValue({ data: sessionData("musicDirector"), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue(undefined);

    await expect(
      RotationAdminLayout({ children: <div data-testid="child-page" /> })
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("404s before any session read when the rotation admin flag is off", async () => {
    delete process.env.NEXT_PUBLIC_ROTATION_ADMIN_ENABLED;
    mockGetSession.mockResolvedValue({ data: sessionData(null), error: null });
    mockGetUserRoleInOrganization.mockResolvedValue("musicDirector");

    await expect(
      RotationAdminLayout({ children: <div data-testid="child-page" /> })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
    // Flag-off is a 404 for everyone — the dark launch must not depend on
    // who is asking, so the auth read is never even attempted.
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});
