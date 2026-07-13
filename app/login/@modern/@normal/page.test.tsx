import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/features/authentication/server-utils", () => ({
  getServerSession: vi.fn(),
  isUserIncomplete: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock(
  "@/src/components/experiences/modern/login/Forms/LoginFormSwitcher",
  () => ({ default: () => null }),
);

import {
  getServerSession,
  isUserIncomplete,
} from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";
import LoginPage from "./page";

const mockGetServerSession = vi.mocked(getServerSession);
const mockIsUserIncomplete = vi.mocked(isUserIncomplete);
const mockRedirect = vi.mocked(redirect);

const completeSession = {
  user: { emailVerified: true },
} as unknown as Awaited<ReturnType<typeof getServerSession>>;

function run(search: Record<string, string | string[] | undefined>) {
  return LoginPage({ searchParams: Promise.resolve(search) });
}

describe("@modern/@normal login page — OIDC-aware redirect (#762)", () => {
  beforeEach(() => {
    mockGetServerSession.mockReset();
    mockIsUserIncomplete.mockReset();
    mockIsUserIncomplete.mockReturnValue(false);
    mockRedirect.mockClear();
  });

  it("resumes the OIDC authorize round-trip for a signed-in complete user", async () => {
    mockGetServerSession.mockResolvedValue(completeSession);

    await expect(
      run({
        client_id: "flowsheet",
        response_type: "code",
        state: "xyz",
        code_challenge: "abc",
      }),
    ).rejects.toThrow(/NEXT_REDIRECT:\/auth\/oauth2\/authorize/);

    const target = String(mockRedirect.mock.calls[0][0]);
    const url = new URL(target, "https://dj.wxyc.org");
    expect(url.pathname).toBe("/auth/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("flowsheet");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.searchParams.get("code_challenge")).toBe("abc");
  });

  it("redirects a signed-in complete user with no OIDC params to the dashboard", async () => {
    mockGetServerSession.mockResolvedValue(completeSession);

    await expect(run({})).rejects.toThrow(/NEXT_REDIRECT:/);

    const target = String(mockRedirect.mock.calls[0][0]);
    expect(target).not.toContain("/auth/oauth2/authorize");
  });

  it("treats a non-code response_type as a non-OIDC visit (dashboard)", async () => {
    mockGetServerSession.mockResolvedValue(completeSession);

    await expect(
      run({ client_id: "flowsheet", response_type: "token" }),
    ).rejects.toThrow(/NEXT_REDIRECT:/);

    const target = String(mockRedirect.mock.calls[0][0]);
    expect(target).not.toContain("/auth/oauth2/authorize");
  });

  it("renders the login form for an unauthenticated visitor (no redirect)", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await run({ client_id: "flowsheet", response_type: "code" });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
  });

  it("does not redirect an onboarding-incomplete user", async () => {
    mockGetServerSession.mockResolvedValue(completeSession);
    mockIsUserIncomplete.mockReturnValue(true);

    const result = await run({ client_id: "flowsheet", response_type: "code" });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
  });
});
