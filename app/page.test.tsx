import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock server-only (required for server component imports)
vi.mock("server-only", () => ({}));

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    // redirect() throws in Next.js to halt rendering
    throw new Error("NEXT_REDIRECT");
  },
  usePathname: () => "/",
}));

// Mock getServerSession
vi.mock("@/lib/features/authentication/server-utils", () => ({
  getServerSession: vi.fn(),
}));

// Mock child components to keep tests focused
vi.mock("@/src/components/experiences/modern/login/Quotes/Welcome", () => ({
  default: () => <div data-testid="welcome-quotes">Welcome</div>,
}));

vi.mock("@/src/Layout/WXYCPage", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="wxyc-page">{children}</div>
  ),
}));

import HomePage from "./page";
import { getServerSession } from "@/lib/features/authentication/server-utils";

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;

describe("HomePage (/)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the landing page when not logged in", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const Component = await HomePage();
    render(Component);

    expect(screen.getByText("Log In")).toBeInTheDocument();
    expect(screen.getByText("Listen")).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard/catalog when logged in and verified", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "dj@wxyc.org",
        name: "Test DJ",
        emailVerified: true,
      },
      session: { token: "test-token" },
    });

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/catalog");
  });

  it("renders the landing page when logged in but email not verified", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "dj@wxyc.org",
        name: "Test DJ",
        emailVerified: false,
      },
      session: { token: "test-token" },
    });

    const Component = await HomePage();
    render(Component);

    expect(screen.getByText("Log In")).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("uses NEXT_PUBLIC_DASHBOARD_HOME_PAGE env var for redirect target", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = "/dashboard/flowsheet";

    mockGetServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "dj@wxyc.org",
        name: "Test DJ",
        emailVerified: true,
      },
      session: { token: "test-token" },
    });

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/flowsheet");

    delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
  });
});
