import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";

// Real session-to-authority resolution; only the token fetch and the session
// store are replaced, so this pins what a transient /token failure does to the
// per-session cache in a production-shaped browser (no organization id).
const mockUseSession = vi.fn();
const mockGetJWTToken = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: (...a: unknown[]) => mockUseSession(...a) },
  authBaseURL: "https://api.wxyc.org/auth",
  clearTokenCache: vi.fn(),
  completeOnboarding: vi.fn(),
  lookupEmailByIdentifier: vi.fn(),
  getJWTToken: () => mockGetJWTToken(),
}));

vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationId: () => undefined,
  getAppOrganizationIdClient: () => undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/src/hooks/applicationHooks", () => ({ resetApplication: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ safeCapture: vi.fn() }));

import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { createTestBetterAuthSession } from "@/tests/fixtures/fixtures";

const USER_ID = "test-user-id-123";

const mintJwt = (claims: Record<string, unknown>) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ id: USER_ID, exp: Math.floor(Date.now() / 1000) + 600, ...claims })}.sig`;
};

// The resolver awaits a dynamic import, so wait for the hook to leave its loading state.
const settle = async (result: { current: { authenticating: boolean } }) => {
  await act(async () => {
    await Promise.resolve();
  });
  await waitFor(() => expect(result.current.authenticating).toBe(false));
};

const authorityOf = (data: unknown) => (data as any).user?.authority;

describe("useAuthentication after a token fetch failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", globalThis.window ?? {});
  });

  it("fails closed, then resolves the real role on the next resolution of the same session", async () => {
    // auth_user.role is null for a music director: only the JWT knows the tier.
    const session = createTestBetterAuthSession({
      user: { ...createTestBetterAuthSession().user, role: null as any },
    });
    mockUseSession.mockReturnValue({ data: session, isPending: false, error: null });

    mockGetJWTToken.mockResolvedValue(null);
    const first = renderHook(() => useAuthentication());
    await settle(first.result);
    expect(authorityOf(first.result.current.data)).toBe(Authorization.NO);
    first.unmount();

    // The /token fetch recovers; a fresh mount of the same session must try again.
    mockGetJWTToken.mockResolvedValue(mintJwt({ role: "musicDirector" }));
    const second = renderHook(() => useAuthentication());
    await settle(second.result);
    expect(authorityOf(second.result.current.data)).toBe(Authorization.MD);
    second.unmount();
  });

  it("keeps a settled resolution cached (a fetched token that names no role is an answer)", async () => {
    const session = createTestBetterAuthSession({
      user: { ...createTestBetterAuthSession().user, id: USER_ID, email: "settled@wxyc.org" },
    });
    mockUseSession.mockReturnValue({ data: session, isPending: false, error: null });
    mockGetJWTToken.mockResolvedValue(mintJwt({ role: "wizard" }));

    const first = renderHook(() => useAuthentication());
    await settle(first.result);
    expect(authorityOf(first.result.current.data)).toBe(Authorization.NO);
    first.unmount();
    const calls = mockGetJWTToken.mock.calls.length;
    expect(calls).toBeGreaterThan(0);

    const second = renderHook(() => useAuthentication());
    await settle(second.result);
    expect(mockGetJWTToken.mock.calls.length).toBe(calls);
    second.unmount();
  });
});
