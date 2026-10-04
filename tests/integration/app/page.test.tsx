import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("@/lib/features/authentication/server-session", () => ({
  getServerSessionResult: vi.fn(),
}));

const mockHeaders = vi.fn(async () => new Headers());
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { getServerSessionResult } from "@/lib/features/authentication/server-session";
import type { SessionReadResult } from "@/lib/features/authentication/utilities";
import HomePage from "@/app/page";

const mockGetServerSessionResult = vi.mocked(getServerSessionResult);

const verifiedRead = {
  kind: "session",
  session: { user: { emailVerified: true } },
} as unknown as SessionReadResult;

const unverifiedRead = {
  kind: "session",
  session: { user: { emailVerified: false } },
} as unknown as SessionReadResult;

describe("root page", () => {
  const originalDashboardHomePage = process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;

  beforeEach(() => {
    mockGetServerSessionResult.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
    delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
  });

  afterAll(() => {
    if (originalDashboardHomePage === undefined) {
      delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
    } else {
      process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = originalDashboardHomePage;
    }
  });

  it.each<[string, SessionReadResult]>([
    ["signed-out", { kind: "absent" }],
    ["signed-in but unverified", unverifiedRead],
    // The dashboard's retry notice tells the visitor their session hasn't
    // ended, which is false without a session cookie.
    ["cookieless (session read failed)", { kind: "unavailable", status: 503 }],
  ])("sends a %s visitor to the login page", async (_label, read) => {
    mockGetServerSessionResult.mockResolvedValue(read);

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("sends a signed-in, verified visitor to the dashboard", async () => {
    mockGetServerSessionResult.mockResolvedValue(verifiedRead);

    await expect(HomePage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/catalog"
    );
  });

  // The dashboard renders its retry notice for a failed read; /login would
  // show a DJ whose cookie is still valid a sign-in form.
  it.each<[string, SessionReadResult]>([
    ["failed", { kind: "unavailable", status: 503 }],
    ["never-delivered", { kind: "unavailable" }],
  ])("sends a session-cookie holder whose read %s to the dashboard", async (_label, read) => {
    mockHeaders.mockResolvedValue(
      new Headers({ cookie: "better-auth.session_token=token" })
    );
    mockGetServerSessionResult.mockResolvedValue(read);

    await expect(HomePage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/catalog"
    );
  });

  it("respects NEXT_PUBLIC_DASHBOARD_HOME_PAGE for the redirect target", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = "/dashboard/flowsheet";
    mockGetServerSessionResult.mockResolvedValue(verifiedRead);

    await expect(HomePage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/flowsheet"
    );
  });
});
