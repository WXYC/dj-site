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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
vi.mock("@/src/components/experiences/modern/reviews/ReviewEditor", () => ({
  default: ({ id }: { id: number }) => <div data-testid="editor">{id}</div>,
}));

vi.mock("@/src/components/experiences/modern/Header/PageHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

import ReviewEditorPage, { metadata } from "@/app/dashboard/@modern/reviews/[id]/page";
import { getPageTitle } from "@/lib/utils/page-title";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

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

describe("review editor page", () => {
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

  const open = (id = "40") => ReviewEditorPage({ params: Promise.resolve({ id }) });

  it.each([
    ["staff", "musicDirector"],
    ["true", "dj"],
  ])("renders the editor when the flag is %s for a %s", async (flag, role) => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    mockGetUserRoleInOrganization.mockResolvedValue(role);

    renderWithProviders(await open());

    expect(screen.getByTestId("editor")).toHaveTextContent("40");
    expect(screen.getByTestId("page-header")).toHaveTextContent(REVIEW_COPY.pageTitle);
  });

  it("titles the tab from the copy module", () => {
    expect(metadata.title).toBe(getPageTitle(REVIEW_COPY.pageTitle));
  });

  it("shows a DJ exactly the staff-only line, and no editor, under staff", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "staff";
    mockGetUserRoleInOrganization.mockResolvedValue("dj");

    renderWithProviders(await open());

    expect(REVIEW_COPY.staffOnly).toBe("Reviews are open to music directors for now. You'll be able to open this review when they open to every DJ.");
    expect(screen.getByText(REVIEW_COPY.staffOnly)).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toHaveTextContent(REVIEW_COPY.pageTitle);
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
  });

  it.each([["dj"], ["musicDirector"]])("is not found for a %s when the flag is off", async (role) => {
    delete process.env.NEXT_PUBLIC_REVIEWS_ENABLED;
    mockGetUserRoleInOrganization.mockResolvedValue(role);

    await expect(open()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is not found for an id that is not a positive integer", async () => {
    process.env.NEXT_PUBLIC_REVIEWS_ENABLED = "true";
    mockGetUserRoleInOrganization.mockResolvedValue("dj");

    await expect(open("abc")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
