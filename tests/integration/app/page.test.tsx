import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/features/authentication/server-utils", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/src/Layout/WXYCPage", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="wxyc-page">{children}</div>
  ),
}));

import { getServerSession } from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";
import HomePage from "@/app/page";

const mockGetServerSession = vi.mocked(getServerSession);
const mockRedirect = vi.mocked(redirect);

const verifiedSession = {
  user: { emailVerified: true },
} as unknown as Awaited<ReturnType<typeof getServerSession>>;

const unverifiedSession = {
  user: { emailVerified: false },
} as unknown as Awaited<ReturnType<typeof getServerSession>>;

describe("root page", () => {
  const originalDashboardHomePage = process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
  const STATION_SIGNUP_FLAG_KEY = "NEXT_PUBLIC_STATION_SIGNUP_ENABLED";
  const originalStationSignupFlag = process.env[STATION_SIGNUP_FLAG_KEY];

  beforeEach(() => {
    mockGetServerSession.mockReset();
    mockRedirect.mockClear();
    delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
    delete process.env[STATION_SIGNUP_FLAG_KEY];
  });

  afterAll(() => {
    if (originalDashboardHomePage === undefined) {
      delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
    } else {
      process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = originalDashboardHomePage;
    }
    if (originalStationSignupFlag === undefined) {
      delete process.env[STATION_SIGNUP_FLAG_KEY];
    } else {
      process.env[STATION_SIGNUP_FLAG_KEY] = originalStationSignupFlag;
    }
  });

  it("renders the landing page for a signed-out visitor", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await HomePage();
    render(result);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText("Log In")).toBeInTheDocument();
    expect(screen.getByText("Listen")).toBeInTheDocument();
  });

  it("redirects a signed-in, verified visitor to the dashboard", async () => {
    mockGetServerSession.mockResolvedValue(verifiedSession);

    await expect(HomePage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/catalog"
    );
  });

  it("renders the landing page for a signed-in but unverified visitor", async () => {
    mockGetServerSession.mockResolvedValue(unverifiedSession);

    const result = await HomePage();
    render(result);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText("Log In")).toBeInTheDocument();
    expect(screen.getByText("Listen")).toBeInTheDocument();
  });

  it("respects NEXT_PUBLIC_DASHBOARD_HOME_PAGE for the redirect target", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = "/dashboard/flowsheet";
    mockGetServerSession.mockResolvedValue(verifiedSession);

    await expect(HomePage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/flowsheet"
    );
  });

  it("renders a Sign Up link into the signup detour when station signup is enabled", async () => {
    process.env[STATION_SIGNUP_FLAG_KEY] = "true";
    mockGetServerSession.mockResolvedValue(null);

    const result = await HomePage();
    render(result);

    const signUpLink = screen.getByRole("link", { name: "Sign Up" });
    expect(signUpLink).toHaveAttribute("href", "/login?signup=1");
  });

  it("renders no Sign Up link when station signup is disabled", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await HomePage();
    render(result);

    expect(screen.queryByRole("link", { name: "Sign Up" })).toBeNull();
  });
});
