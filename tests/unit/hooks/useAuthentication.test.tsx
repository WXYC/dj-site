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
vi.mock("@/src/hooks/applicationHooks", () => ({ resetApplication: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ safeCapture: vi.fn() }));

import {
  useAuthentication,
  useRegistry,
} from "@/src/hooks/authenticationHooks";

// The org-role dedupe is a module-level single-slot cache keyed by session
// identity. Rather than reach into it to reset between cases, each test uses a
// unique session id so keys never collide across cases in this file.
describe("useAuthentication async role fetch (#612)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSync.mockReturnValue({ message: "Not Authenticated" });
  });

  it("discards a stale session's role fetch when the session changes mid-flight", async () => {
    const sessionA = { user: { id: "stale-A" } };
    const sessionB = { user: { id: "stale-B" } };
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

  it("settles authenticating=false when the session ends mid-fetch, and still discards the stale result", async () => {
    const sessionA = { user: { id: "settle-A" } };
    let resolveA!: (v: unknown) => void;
    const pA = new Promise<unknown>((r) => { resolveA = r; });
    mockAsync.mockReturnValueOnce(pA);

    mockUseSession.mockReturnValue({ data: sessionA, isPending: false, error: null });
    const { result, rerender } = renderHook(() => useAuthentication());
    expect(result.current.authenticating).toBe(true);

    // Logout/expiry while A's role fetch is still in flight.
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
    rerender();

    // The cancelled fetch's finally can no longer reset isLoadingRole, so the
    // no-session branch must — otherwise `authenticating` sticks true forever.
    expect(result.current.authenticating).toBe(false);
    expect(result.current.data).toEqual({ message: "Not Authenticated" });

    // A's fetch resolving late must not clobber the signed-out state.
    await act(async () => {
      resolveA({ message: "Authenticated", user: { id: "A", role: "dj" } });
      await pA;
      await Promise.resolve();
    });

    expect(result.current.data).toEqual({ message: "Not Authenticated" });
    expect(result.current.authenticating).toBe(false);
  });

  it("applies the role fetch result for a stable session", async () => {
    const session = { user: { id: "stable-A" } };
    const data = { message: "Authenticated", user: { id: "stable-A", role: "dj" } };
    mockAsync.mockResolvedValue(data);
    mockUseSession.mockReturnValue({ data: session, isPending: false, error: null });

    const { result } = renderHook(() => useAuthentication());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(data);
  });

  it("resolves the org-role exactly once per session regardless of consumer count", async () => {
    const session = { user: { id: "count-A" } };
    const data = { message: "Authenticated", user: { id: "count-A", role: "dj" } };
    mockAsync.mockResolvedValue(data);
    mockUseSession.mockReturnValue({ data: session, isPending: false, error: null });

    // Mount many consumers of the same session (guards, registry, catalog hooks,
    // etc. all call useAuthentication). The module-level owner must dedupe the
    // org-role resolution to a single call.
    const hooks = Array.from({ length: 6 }, () =>
      renderHook(() => useAuthentication()),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockAsync).toHaveBeenCalledTimes(1);
    for (const h of hooks) {
      expect(h.result.current.data).toEqual(data);
    }
    hooks.forEach((h) => h.unmount());
  });
});

describe("useRegistry referential stability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSync.mockReturnValue({ message: "Not Authenticated" });
  });

  it("keeps `info` referentially stable across renders when content is unchanged", async () => {
    const session = { user: { id: "reg-A" } };
    const data = {
      message: "Authenticated",
      user: { id: "reg-A", realName: "Jo", djName: "DJ Jo" },
    };
    mockAsync.mockResolvedValue(data);
    mockUseSession.mockReturnValue({ data: session, isPending: false, error: null });

    const { result, rerender } = renderHook(() => useRegistry());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const first = result.current.info;
    expect(first).toEqual({ id: "reg-A", real_name: "Jo", dj_name: "DJ Jo" });

    rerender();
    // Same identity — a fresh object each render would invalidate the
    // useCallback/effect deps that flowsheet/bin/dj hooks build from `info`.
    expect(result.current.info).toBe(first);
  });
});
