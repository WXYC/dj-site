import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
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

import ReviewsPage from "@/app/dashboard/@modern/reviews/page";

function sessionData() {
  return {
    user: {
      id: "user-1",
      email: "dj@wxyc.org",
      name: "Test User",
      username: "testuser",
      role: null,
      emailVerified: true,
      hasCompletedOnboarding: true,
    },
    session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
  };
}

describe("reviews page", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserRoleInOrganization.mockReset();
    mockGetAppOrganizationId.mockReturnValue(undefined);
    mockCookiesToString.mockReturnValue("session=test-cookie");
    mockGetSession.mockResolvedValue({ data: sessionData(), error: null });
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    [undefined, "dj"],
    [undefined, "musicDirector"],
    [undefined, "stationManager"],
    ["false", "stationManager"],
    ["staff", "dj"],
  ])("is not found when the flag is %s for a %s", async (flag, role) => {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_REVIEWS_ENABLED;
    else process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    mockGetUserRoleInOrganization.mockResolvedValue(role);

    await expect(ReviewsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it.each([
    ["staff", "musicDirector"],
    ["staff", "stationManager"],
    ["true", "dj"],
    ["1", "dj"],
  ])("renders the Reviews shell when the flag is %s for a %s", async (flag, role) => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    mockGetUserRoleInOrganization.mockResolvedValue(role);

    const result = await ReviewsPage();
    renderWithProviders(result);

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(screen.getByTestId("page-header")).toHaveTextContent("Reviews");
  });
});
