import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { authenticationSlice } from "@/lib/features/authentication/frontend";

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockRefresh = vi.fn();
const mockSearchParamsGet = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: (...args: any[]) => mockSearchParamsGet(...args),
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock PostHog telemetry — assert the login_post_redirect event without
// initialising PostHog. safeCapture already swallows in SSR/tests, but mocking
// it lets us inspect the emitted event + props.
const mockSafeCapture = vi.fn();
vi.mock("@/lib/posthog", () => ({
  safeCapture: (...args: any[]) => mockSafeCapture(...args),
}));

// Mock authClient
const mockUpdateUser = vi.fn();
const mockChangePassword = vi.fn();
const mockGetSession = vi.fn();
const mockSignInUsername = vi.fn();
const mockSignInEmail = vi.fn();
const mockSignInEmailOtp = vi.fn();
const mockSendVerificationOtp = vi.fn();
const mockLookupEmailByIdentifier = vi.fn();
const mockSignOut = vi.fn();
const mockClearTokenCache = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  authBaseURL: "http://localhost:8082/auth",
  authClient: {
    updateUser: (...args: any[]) => mockUpdateUser(...args),
    changePassword: (...args: any[]) => mockChangePassword(...args),
    getSession: (...args: any[]) => mockGetSession(...args),
    signIn: {
      username: (...args: any[]) => mockSignInUsername(...args),
      email: (...args: any[]) => mockSignInEmail(...args),
      emailOtp: (...args: any[]) => mockSignInEmailOtp(...args),
    },
    emailOtp: {
      sendVerificationOtp: (...args: any[]) => mockSendVerificationOtp(...args),
    },
    signOut: (...args: any[]) => mockSignOut(...args),
  },
  clearTokenCache: (...args: any[]) => mockClearTokenCache(...args),
  lookupEmailByIdentifier: (...args: any[]) => mockLookupEmailByIdentifier(...args),
}));

// Mock throwIfBetterAuthError
vi.mock("@/src/utilities/throwIfBetterAuthError", () => ({
  throwIfBetterAuthError: vi.fn(),
}));

// Mock applicationHooks
vi.mock("./applicationHooks", () => ({
  resetApplication: vi.fn(),
}));

function createTestStore() {
  return configureStore({
    reducer: {
      authentication: authenticationSlice.reducer,
    },
  });
}

function createWrapper() {
  const store = createTestStore();
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(Provider, { store, children });
  };
}

describe("authenticationHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = "/dashboard/flowsheet";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        userId: "user-1",
        email: "dj@example.com",
        username: "testdj",
      }),
    } as Response);
    // Default: the server can see the freshly-established session on the first
    // check, so redirectAfterAuth's confirm-before-navigate gate passes without
    // any retry delay. Individual tests override this to exercise the race.
    mockGetSession.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  // Safety net: several tests opt into fake timers and restore real timers as
  // their last line. If one of those assertions throws first, this guarantees
  // fake timers can't leak into and hang the following tests.
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("useLogin", () => {
    it("should redirect to incomplete when hasCompletedOnboarding is false", async () => {
      mockSignInUsername.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            realName: "Test User",
            djName: "DJ Test",
            hasCompletedOnboarding: false,
          },
        },
      });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testdj" },
          password: { value: "password123" },
        },
      } as any;

      await act(async () => {
        await result.current.handleLogin(form);
      });

      expect(mockPush).toHaveBeenCalledWith("/login?incomplete=true");
      expect(mockSafeCapture).toHaveBeenCalledWith("login_post_redirect", {
        method: "password",
        destination: "incomplete",
        has_completed_onboarding: false,
        user_id: "user-1",
        session_confirmed: true,
      });
    });

    it("should redirect to dashboard when hasCompletedOnboarding is true", async () => {
      mockSignInUsername.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            realName: "Test User",
            djName: "DJ Test",
            hasCompletedOnboarding: true,
          },
        },
      });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testdj" },
          password: { value: "password123" },
        },
      } as any;

      await act(async () => {
        await result.current.handleLogin(form);
      });

      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
      expect(mockSafeCapture).toHaveBeenCalledWith("login_post_redirect", {
        method: "password",
        destination: "dashboard",
        has_completed_onboarding: true,
        user_id: "user-1",
        session_confirmed: true,
      });
    });

    it("should redirect to incomplete when hasCompletedOnboarding is undefined", async () => {
      mockSignInUsername.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            realName: "Test User",
            djName: "DJ Test",
          },
        },
      });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testdj" },
          password: { value: "password123" },
        },
      } as any;

      await act(async () => {
        await result.current.handleLogin(form);
      });

      expect(mockPush).toHaveBeenCalledWith("/login?incomplete=true");
      expect(mockSafeCapture).toHaveBeenCalledWith("login_post_redirect", {
        method: "password",
        destination: "incomplete",
        has_completed_onboarding: null,
        user_id: "user-1",
        session_confirmed: true,
      });
    });

    it("routes to signIn.username when the identifier has no @", async () => {
      mockSignInUsername.mockResolvedValue({ data: { user: { id: "user-1" } } });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "jbromberg" },
          password: { value: "password123" },
        },
      } as any;

      await act(async () => {
        await result.current.handleLogin(form);
      });

      expect(mockSignInUsername).toHaveBeenCalledWith({
        username: "jbromberg",
        password: "password123",
      });
      expect(mockSignInEmail).not.toHaveBeenCalled();
    });

    it("routes to signIn.email when the identifier contains @", async () => {
      mockSignInEmail.mockResolvedValue({ data: { user: { id: "user-1" } } });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "jbromberg@wxyc.org" },
          password: { value: "password123" },
        },
      } as any;

      await act(async () => {
        await result.current.handleLogin(form);
      });

      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: "jbromberg@wxyc.org",
        password: "password123",
      });
      expect(mockSignInUsername).not.toHaveBeenCalled();
    });
  });

  describe("useOTPRequest", () => {
    it("resolves a username via lookup before calling sendVerificationOtp", async () => {
      mockLookupEmailByIdentifier.mockResolvedValue("jbromberg@wxyc.org");
      mockSendVerificationOtp.mockResolvedValue({ data: {} });

      const { useOTPRequest } = await import("./authenticationHooks");
      const { result } = renderHook(() => useOTPRequest(), { wrapper: createWrapper() });

      let returned: { email: string } | undefined;
      await act(async () => {
        returned = await result.current.handleSendOTP("jbromberg");
      });

      expect(mockLookupEmailByIdentifier).toHaveBeenCalledWith("jbromberg");
      expect(mockSendVerificationOtp).toHaveBeenCalledWith({
        email: "jbromberg@wxyc.org",
        type: "sign-in",
      });
      expect(returned).toEqual({ email: "jbromberg@wxyc.org" });
    });

    it("passes an email identifier through to sendVerificationOtp unchanged", async () => {
      mockLookupEmailByIdentifier.mockResolvedValue("dj@wxyc.org");
      mockSendVerificationOtp.mockResolvedValue({ data: {} });

      const { useOTPRequest } = await import("./authenticationHooks");
      const { result } = renderHook(() => useOTPRequest(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.handleSendOTP("dj@wxyc.org");
      });

      expect(mockSendVerificationOtp).toHaveBeenCalledWith({
        email: "dj@wxyc.org",
        type: "sign-in",
      });
    });

    it("throws when the lookup returns null", async () => {
      mockLookupEmailByIdentifier.mockResolvedValue(null);

      const { useOTPRequest } = await import("./authenticationHooks");
      const { result } = renderHook(() => useOTPRequest(), { wrapper: createWrapper() });

      await act(async () => {
        await expect(result.current.handleSendOTP("nobody")).rejects.toThrow();
      });

      expect(mockSendVerificationOtp).not.toHaveBeenCalled();
    });
  });

  describe("useOTPVerify", () => {
    it("redirects to incomplete and captures the OTP redirect when hasCompletedOnboarding is false", async () => {
      mockSignInEmailOtp.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            hasCompletedOnboarding: false,
          },
        },
      });

      const { useOTPVerify } = await import("./authenticationHooks");
      const { result } = renderHook(() => useOTPVerify(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.handleVerifyOTP("dj@wxyc.org", "123456");
      });

      expect(mockPush).toHaveBeenCalledWith("/login?incomplete=true");
      expect(mockSafeCapture).toHaveBeenCalledWith("login_post_redirect", {
        method: "otp",
        destination: "incomplete",
        has_completed_onboarding: false,
        user_id: "user-1",
        session_confirmed: true,
      });
    });
  });

  describe("useNewUser", () => {
    it("posts to complete-onboarding then signs in and redirects to dashboard", async () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === "token" ? "setup-token-abc" : null
      );
      mockSignInUsername.mockResolvedValue({ data: { user: { id: "user-1" } } });
      mockGetSession
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: { user: { id: "user-1", hasCompletedOnboarding: true } } });

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testdj" },
          password: { value: "NewPassword1" },
          realName: { value: "Real Name" },
          djName: { value: "DJ Name" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8082/auth/wxyc/complete-onboarding",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            newPassword: "NewPassword1",
            token: "setup-token-abc",
            realName: "Real Name",
            djName: "DJ Name",
          }),
        })
      );
      expect(mockClearTokenCache).toHaveBeenCalled();
      expect(mockSignInUsername).toHaveBeenCalledWith({
        username: "testdj",
        password: "NewPassword1",
      });
      expect(mockSignInEmail).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
    });

    it("skips client sign-in when the server already established a session", async () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === "token" ? "setup-token-abc" : null
      );
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          userId: "user-1",
          email: "dj@example.com",
          username: "testdj",
          sessionEstablished: true,
        }),
      } as Response);
      mockGetSession.mockResolvedValue({
        data: { user: { id: "user-1", hasCompletedOnboarding: true } },
      });

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          password: { value: "NewPassword1" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(mockSignInUsername).not.toHaveBeenCalled();
      expect(mockSignInEmail).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
    });

    it("falls back to username sign-in when email is absent", async () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === "token" ? "setup-token-abc" : null
      );
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          userId: "user-1",
          username: "testdj",
        }),
      } as Response);
      mockSignInUsername.mockResolvedValue({ data: { user: { id: "user-1" } } });
      mockGetSession
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: { user: { id: "user-1", hasCompletedOnboarding: true } } });

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          password: { value: "NewPassword1" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(mockSignInUsername).toHaveBeenCalledWith({
        username: "testdj",
        password: "NewPassword1",
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
    });

    it("rejects onboarding without a setup token", async () => {
      mockSearchParamsGet.mockReturnValue(null);

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testdj" },
          password: { value: "NewPassword1" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("does not navigate when complete-onboarding fails", async () => {
      mockGetSession.mockResolvedValue({ data: { user: { id: "user-1" } } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid or expired setup token" }),
      } as Response);

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testdj" },
          password: { value: "NewPassword1" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("useLogout (WXYC/dj-site#596)", () => {
    it("clears the JWT token cache before calling signOut", async () => {
      const callOrder: string[] = [];
      mockClearTokenCache.mockImplementation(() => {
        callOrder.push("clearTokenCache");
      });
      mockSignOut.mockImplementation(async () => {
        callOrder.push("signOut");
      });

      const { useLogout } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockClearTokenCache).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      // Cache must be cleared synchronously *before* signOut is awaited so any
      // racing call to getJWTToken() can't pull the departing user's bearer.
      expect(callOrder).toEqual(["clearTokenCache", "signOut"]);
    });

    it("clears the JWT token cache even when no form event is supplied", async () => {
      const { useLogout } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockClearTokenCache).toHaveBeenCalledTimes(1);
    });

    it("navigates explicitly to a clean /login after signing out, instead of routing through the requireAuth no-session bounce", async () => {
      mockSignOut.mockResolvedValue(undefined);

      const { useLogout } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.handleLogout();
      });

      // A deliberate logout must land on /login itself — NOT lean on the
      // dashboard's requireAuth() to redirect to /login?bounced=no-session,
      // which would fire a false-positive login_server_bounce event. Uses
      // replace() so the unauthorized dashboard isn't left in history and so it
      // collapses with callers (e.g. AuthBackButton) that already replace().
      expect(mockReplace).toHaveBeenCalledWith("/login");
      expect(mockReplace).not.toHaveBeenCalledWith(
        expect.stringContaining("bounced"),
      );
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("session confirm-before-navigate gate (login no-session race)", () => {
    const passwordForm = {
      preventDefault: vi.fn(),
      currentTarget: {
        username: { value: "jbromberg" },
        password: { value: "password123" },
      },
    } as any;

    it("confirms the session is visible server-side before navigating after login", async () => {
      const callOrder: string[] = [];
      mockSignInUsername.mockImplementation(async () => {
        callOrder.push("signIn");
        return { data: { user: { id: "user-1", hasCompletedOnboarding: true } } };
      });
      mockGetSession.mockImplementation(async () => {
        callOrder.push("getSession");
        return { data: { user: { id: "user-1" } } };
      });
      mockPush.mockImplementation(() => {
        callOrder.push("push");
      });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.handleLogin(passwordForm);
      });

      // Force a fresh read (bypass better-auth's cookie cache) so we observe the
      // real server verdict, not a stale client snapshot.
      expect(mockGetSession).toHaveBeenCalledWith({
        query: { disableCookieCache: true },
      });
      // The gate must run BETWEEN sign-in and navigation.
      expect(callOrder).toEqual(["signIn", "getSession", "push"]);
    });

    it("retries until the session becomes visible, then navigates with session_confirmed:true", async () => {
      vi.useFakeTimers();
      mockSignInUsername.mockResolvedValue({
        data: { user: { id: "user-1", hasCompletedOnboarding: true } },
      });
      // First read races (no session yet), second read sees it.
      mockGetSession
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValue({ data: { user: { id: "user-1" } } });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      await act(async () => {
        const pending = result.current.handleLogin(passwordForm);
        await vi.runAllTimersAsync();
        await pending;
      });

      expect(mockGetSession).toHaveBeenCalledTimes(2);
      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
      expect(mockSafeCapture).toHaveBeenCalledWith(
        "login_post_redirect",
        expect.objectContaining({ session_confirmed: true }),
      );
      vi.useRealTimers();
    });

    it("refreshes instead of pushing into a known bounce when the session never confirms, tagging session_confirmed:false", async () => {
      vi.useFakeTimers();
      mockSignInUsername.mockResolvedValue({
        data: { user: { id: "user-1", hasCompletedOnboarding: true } },
      });
      mockGetSession.mockResolvedValue({ data: null });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      await act(async () => {
        const pending = result.current.handleLogin(passwordForm);
        await vi.runAllTimersAsync();
        await pending;
      });

      // Don't push into a dashboard nav we already know will bounce (and falsely
      // trip the session-ended notice). Refresh and let the /login layout be the
      // authority; still record the miss so it stays observable in PostHog.
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalledWith("/dashboard/flowsheet");
      expect(mockSafeCapture).toHaveBeenCalledWith(
        "login_post_redirect",
        expect.objectContaining({ session_confirmed: false }),
      );
      vi.useRealTimers();
    });

    it("does not hang when getSession stalls: the per-attempt timeout bounds the loop and it still resolves", async () => {
      vi.useFakeTimers();
      mockSignInUsername.mockResolvedValue({
        data: { user: { id: "user-1", hasCompletedOnboarding: true } },
      });
      // getSession never settles — only the per-attempt timeout can end each
      // attempt. Without the timeout the await would hang forever.
      mockGetSession.mockReturnValue(new Promise(() => {}));

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      await act(async () => {
        const pending = result.current.handleLogin(passwordForm);
        await vi.runAllTimersAsync();
        await pending;
      });

      // Bounded, not infinite: the loop exhausts its timed-out attempts and the
      // handler resolves (refreshing, not spinning) rather than hanging forever.
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalledWith("/dashboard/flowsheet");
      expect(mockSafeCapture).toHaveBeenCalledWith(
        "login_post_redirect",
        expect.objectContaining({ session_confirmed: false }),
      );
      vi.useRealTimers();
    });

    it("treats a rejected read as a failed attempt and keeps polling", async () => {
      vi.useFakeTimers();
      mockSignInUsername.mockResolvedValue({
        data: { user: { id: "user-1", hasCompletedOnboarding: true } },
      });
      // A rejected read must be swallowed (no unhandled rejection) and retried,
      // not abort the gate.
      mockGetSession
        .mockRejectedValueOnce(new Error("network blip"))
        .mockResolvedValue({ data: { user: { id: "user-1" } } });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      await act(async () => {
        const pending = result.current.handleLogin(passwordForm);
        await vi.runAllTimersAsync();
        await pending;
      });

      expect(mockGetSession).toHaveBeenCalledTimes(2);
      expect(mockSafeCapture).toHaveBeenCalledWith(
        "login_post_redirect",
        expect.objectContaining({ session_confirmed: true }),
      );
      vi.useRealTimers();
    });
  });

  describe("useLogin (WXYC/dj-site#596 defensive)", () => {
    it("clears the JWT token cache before signing in", async () => {
      const callOrder: string[] = [];
      mockClearTokenCache.mockImplementation(() => {
        callOrder.push("clearTokenCache");
      });
      mockSignInUsername.mockImplementation(async () => {
        callOrder.push("signInUsername");
        return { data: { user: { id: "user-1", hasCompletedOnboarding: true } } };
      });

      const { useLogin } = await import("./authenticationHooks");
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "jbromberg" },
          password: { value: "password123" },
        },
      } as any;

      await act(async () => {
        await result.current.handleLogin(form);
      });

      expect(mockClearTokenCache).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(["clearTokenCache", "signInUsername"]);
    });
  });

  describe("useOTPVerify (WXYC/dj-site#596 defensive)", () => {
    it("clears the JWT token cache before verifying the OTP", async () => {
      const callOrder: string[] = [];
      mockClearTokenCache.mockImplementation(() => {
        callOrder.push("clearTokenCache");
      });
      mockSignInEmailOtp.mockImplementation(async () => {
        callOrder.push("signInEmailOtp");
        return { data: { user: { id: "user-1", hasCompletedOnboarding: true } } };
      });

      const { useOTPVerify } = await import("./authenticationHooks");
      const { result } = renderHook(() => useOTPVerify(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.handleVerifyOTP("dj@wxyc.org", "123456");
      });

      expect(mockClearTokenCache).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(["clearTokenCache", "signInEmailOtp"]);
    });
  });
});
