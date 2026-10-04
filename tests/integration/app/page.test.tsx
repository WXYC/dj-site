import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("@/lib/features/authentication/server-utils", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { getServerSession } from "@/lib/features/authentication/server-utils";
import HomePage from "@/app/page";

const mockGetServerSession = vi.mocked(getServerSession);

const verifiedSession = {
  user: { emailVerified: true },
} as unknown as Awaited<ReturnType<typeof getServerSession>>;

const unverifiedSession = {
  user: { emailVerified: false },
} as unknown as Awaited<ReturnType<typeof getServerSession>>;

describe("root page", () => {
  const originalDashboardHomePage = process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;

  beforeEach(() => {
    mockGetServerSession.mockReset();
    delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
  });

  afterAll(() => {
    if (originalDashboardHomePage === undefined) {
      delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
    } else {
      process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = originalDashboardHomePage;
    }
  });

  it.each([
    ["signed-out", null],
    ["signed-in but unverified", unverifiedSession],
  ])("sends a %s visitor to the login page", async (_label, session) => {
    mockGetServerSession.mockResolvedValue(session);

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects a signed-in, verified visitor to the dashboard", async () => {
    mockGetServerSession.mockResolvedValue(verifiedSession);

    await expect(HomePage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/catalog"
    );
  });

  it("respects NEXT_PUBLIC_DASHBOARD_HOME_PAGE for the redirect target", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = "/dashboard/flowsheet";
    mockGetServerSession.mockResolvedValue(verifiedSession);

    await expect(HomePage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/flowsheet"
    );
  });
});
