import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// useAuthentication only reads authClient.useSession and the session→auth-data
// converters; mock those so we can drive a session transition and control when
// each role fetch resolves. The other client exports are referenced at module
// import time by sibling hooks (not by useAuthentication) — stub them so the
// module loads.
const mockUseSession = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: (...a: unknown[]) => mockUseSession(...a) },
  authBaseURL: "https://api.wxyc.org/auth",
  clearTokenCache: vi.fn(),
  completeOnboarding: vi.fn(),
  lookupEmailByIdentifier: vi.fn(),
}));

const mockAsync = vi.fn();
const mockSync = vi.fn();
vi.mock("@/lib/features/authentication/utilities", () => ({
  betterAuthSessionToAuthenticationDataAsync: (...a: unknown[]) => mockAsync(...a),
  betterAuthSessionToAuthenticationData: (...a: unknown[]) => mockSync(...a),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./applicationHooks", () => ({ resetApplication: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ safeCapture: vi.fn() }));

import { useAuthentication } from "./authenticationHooks";

describe("useAuthentication async role fetch (#612)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSync.mockReturnValue({ message: "Not Authenticated" });
  });

  it("discards a stale session's role fetch when the session changes mid-flight", async () => {
    const sessionA = { user: { id: "A" } };
    const sessionB = { user: { id: "B" } };
    const dataA = { message: "Authenticated", user: { id: "A", role: "stationManager" } };
    const dataB = { message: "Authenticated", user: { id: "B", role: "dj" } };

    let resolveA!: (v: unknown) => void;
    let resolveB!: (v: unknown) => void;
    const pA = new Promise<unknown>((r) => { resolveA = r; });
    const pB = new Promise<unknown>((r) => { resolveB = r; });
    mockAsync.mockReturnValueOnce(pA).mockReturnValueOnce(pB);

    mockUseSession.mockReturnValue({ data: sessionA, isPending: false, error: null });
    const { result, rerender } = renderHook(() => useAuthentication());

    // Session transitions A -> B before A's role fetch has resolved.
    mockUseSession.mockReturnValue({ data: sessionB, isPending: false, error: null });
    rerender();

    // The NEWER fetch (B) resolves first...
    await act(async () => {
      resolveB(dataB);
      await pB;
      await Promise.resolve();
    });
    // ...then the STALE fetch (A) resolves late. Without the cancellation guard
    // it would clobber authData with the previous session's role.
    await act(async () => {
      resolveA(dataA);
      await pA;
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(dataB);
  });

  it("applies the role fetch result for a stable session", async () => {
    const session = { user: { id: "A" } };
    const data = { message: "Authenticated", user: { id: "A", role: "dj" } };
    mockAsync.mockResolvedValue(data);
    mockUseSession.mockReturnValue({ data: session, isPending: false, error: null });

    const { result } = renderHook(() => useAuthentication());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(data);
  });
});
