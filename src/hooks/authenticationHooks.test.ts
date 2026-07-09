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
const mockSearchParams = vi.fn<() => URLSearchParams>(() => new URLSearchParams(""));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
  }),
  useSearchParams: () => mockSearchParams(),
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
const mockCompleteOnboarding = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
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
  // On the client, getBaseURL() returns the same-origin `/auth` proxy (see
  // client.ts) — NOT the cross-origin api.wxyc.org URL. Mock the value the
  // hooks actually see in the browser so the OIDC redirect target is the
  // same-origin path that router.push would have mishandled.
  authBaseURL: `${window.location.origin}/auth`,
  clearTokenCache: (...args: any[]) => mockClearTokenCache(...args),
  lookupEmailByIdentifier: (...args: any[]) => mockLookupEmailByIdentifier(...args),
  completeOnboarding: (...args: any[]) => mockCompleteOnboarding(...args),
}));

// Mock throwIfBetterAuthError
vi.mock("@/src/utilities/throwIfBetterAuthError", () => ({
  throwIfBetterAuthError: vi.fn(),
}));

// Mock applicationHooks
vi.mock("./applicationHooks", () => ({
  resetApplication: vi.fn(),
}));

// Mock only the device-auth fetch wrappers; keep the real interpretTokenPoll so
// the hook's branching is exercised against the genuine state machine.
const mockRequestDeviceCode = vi.fn();
const mockPollDeviceToken = vi.fn();
vi.mock("@/lib/features/authentication/device-auth", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/features/authentication/device-auth")
    >();
  return {
    ...actual,
    requestDeviceCode: (...args: any[]) => mockRequestDeviceCode(...args),
    pollDeviceToken: (...args: any[]) => mockPollDeviceToken(...args),
  };
});

const DEVICE_CODE_RESPONSE = {
  device_code: "dev_123",
  user_code: "WDPL-XK9R",
  verification_uri: "https://dj.wxyc.org/auth/device",
  verification_uri_complete:
    "https://dj.wxyc.org/auth/device?user_code=WDPL-XK9R",
  expires_in: 300,
  interval: 5,
};

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

// The OIDC resume branch leaves the SPA via window.location.assign (a full
// document navigation). jsdom's location.assign is non-configurable, so we
// swap in a plain fake location that forwards the real origin/href and spies
// on assign, then restore it after each test.
const realLocation = window.location;
const mockLocationAssign = vi.fn();

describe("authenticationHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationAssign.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        origin: realLocation.origin,
        href: realLocation.href,
        pathname: realLocation.pathname,
        search: realLocation.search,
        assign: mockLocationAssign,
        replace: vi.fn(),
        reload: vi.fn(),
      },
    });
    mockSearchParams.mockReturnValue(new URLSearchParams(""));
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = "/dashboard/flowsheet";
    mockCompleteOnboarding.mockResolvedValue({
      status: true,
      userId: "user-1",
      email: "dj@example.com",
      username: "testdj",
    });
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

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: realLocation,
    });
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

    it("redirects to the OIDC authorize URL when the login page receives OIDC params", async () => {
      // Resume contract: when `/login` is hit with `client_id` + `response_type=code`,
      // sign-in is being delegated from `${authBase}/oauth2/authorize`. On success we
      // must redirect back to `${authBase}/oauth2/authorize?<same-query-string>` so the
      // Better Auth `oidcProvider` plugin sees the now-established session cookie,
      // issues the code, and bounces to the registered client redirect URI.
      const search =
        "client_id=flowsheet&response_type=code&redirect_uri=https%3A%2F%2Fflowsheet.wxyc.org%2Fauth%2Fcallback&state=xyz&code_challenge=abc&code_challenge_method=S256";
      mockSearchParams.mockReturnValue(new URLSearchParams(search));
      mockSignInUsername.mockResolvedValue({
        data: { user: { id: "user-1", hasCompletedOnboarding: true } },
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

      expect(mockLocationAssign).toHaveBeenCalledWith(
        `${window.location.origin}/auth/oauth2/authorize?${search}`
      );
      // OIDC resume is a hard document navigation out of the SPA: the App
      // Router must NOT be touched — a same-origin router.push would soft-
      // navigate and fire a code-consuming RSC fetch — and refresh would be
      // a wasted fetch against a route the user is leaving.
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("falls back to the dashboard when only one of client_id / response_type is present", async () => {
      // Stray `client_id` (e.g. a stale link or someone exploring the URL) must
      // not pull the user away from the dashboard — both signals are required.
      mockSearchParams.mockReturnValue(
        new URLSearchParams("client_id=flowsheet")
      );
      mockSignInUsername.mockResolvedValue({
        data: { user: { id: "user-1", hasCompletedOnboarding: true } },
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

      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
      // Dashboard branch stays inside the SPA — refresh is the existing
      // post-sign-in behavior the OIDC branch deliberately skips.
      expect(mockRefresh).toHaveBeenCalled();
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
    it("invite mode: posts token + password, signs in via authClient, redirects to dashboard", async () => {
      mockSearchParams.mockReturnValue(
        new URLSearchParams("token=setup-token-abc"),
      );
      mockSignInEmail.mockResolvedValue({ data: { user: { id: "user-1" } } });

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser("invite"), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          password: { value: "NewPassword1" },
          realName: { value: "Real Name" },
          djName: { value: "DJ Name" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(mockCompleteOnboarding).toHaveBeenCalledWith({
        realName: "Real Name",
        djName: "DJ Name",
        token: "setup-token-abc",
        newPassword: "NewPassword1",
      });
      expect(mockClearTokenCache).toHaveBeenCalled();
      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: "dj@example.com",
        password: "NewPassword1",
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
    });

    it("invite mode: routes to login when sign-in fails after onboarding succeeds", async () => {
      mockSearchParams.mockReturnValue(
        new URLSearchParams("token=setup-token-abc"),
      );
      mockSignInEmail.mockResolvedValue({
        error: { message: "Email not verified" },
      });

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser("invite"), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          password: { value: "NewPassword1" },
          realName: { value: "Real Name" },
          djName: { value: "" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(mockPush).toHaveBeenCalledWith("/login");
      const { toast } = await import("sonner");
      expect(toast.success).toHaveBeenCalledWith(
        "Account setup complete. Please sign in with your new password."
      );
    });

    it("invite mode: rejects onboarding without a setup token", async () => {
      mockSearchParams.mockReturnValue(new URLSearchParams(""));

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser("invite"), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          password: { value: "NewPassword1" },
          realName: { value: "Real Name" },
          djName: { value: "" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(mockCompleteOnboarding).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("session mode: posts profile fields only and redirects without signing in", async () => {
      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser("session"), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          realName: { value: "Real Name" },
          djName: { value: "DJ Name" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(mockCompleteOnboarding).toHaveBeenCalledWith({
        realName: "Real Name",
        djName: "DJ Name",
      });
      expect(mockSignInEmail).not.toHaveBeenCalled();
      expect(mockSignInUsername).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
    });

    it("does not navigate when complete-onboarding fails", async () => {
      mockSearchParams.mockReturnValue(
        new URLSearchParams("token=setup-token-abc"),
      );
      mockCompleteOnboarding.mockRejectedValue(new Error("Invalid or expired setup token"));

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser("invite"), { wrapper: createWrapper() });

      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          password: { value: "NewPassword1" },
          realName: { value: "Real Name" },
          djName: { value: "" },
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(mockSignInEmail).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      const { toast } = await import("sonner");
      expect(toast.error).toHaveBeenCalledWith("Invalid or expired setup token");
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

    it("redirects to the OIDC authorize URL when the login page receives OIDC params", async () => {
      // Same resume contract as `useLogin` — the OIDC bounce path doesn't care
      // which credential type the user picked; both `signIn.username/email` and
      // `signIn.emailOtp` are entry points into the same authorize round-trip.
      const search =
        "client_id=flowsheet&response_type=code&redirect_uri=https%3A%2F%2Fflowsheet.wxyc.org%2Fauth%2Fcallback&state=xyz";
      mockSearchParams.mockReturnValue(new URLSearchParams(search));
      mockSignInEmailOtp.mockResolvedValue({
        data: { user: { id: "user-1", hasCompletedOnboarding: true } },
      });

      const { useOTPVerify } = await import("./authenticationHooks");
      const { result } = renderHook(() => useOTPVerify(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.handleVerifyOTP("dj@wxyc.org", "123456");
      });

      expect(mockLocationAssign).toHaveBeenCalledWith(
        `${window.location.origin}/auth/oauth2/authorize?${search}`
      );
      // Hard nav here too: no App Router push (guards against a missing
      // `return` falling through to router.push(dashboardHome)) and no
      // refresh.
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  describe("useDeviceAuthorization", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockRequestDeviceCode.mockResolvedValue(DEVICE_CODE_RESPONSE);
      mockPollDeviceToken.mockResolvedValue({
        status: 400,
        body: {
          error: "authorization_pending",
          error_description: "Authorization pending",
        },
      });
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it("requests a device code on mount and exposes the user_code + verification URI", async () => {
      const { useDeviceAuthorization } = await import("./authenticationHooks");
      const { result } = renderHook(() => useDeviceAuthorization(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(mockRequestDeviceCode).toHaveBeenCalledWith("dj-site");
      expect(result.current.userCode).toBe("WDPL-XK9R");
      expect(result.current.verificationUriComplete).toBe(
        DEVICE_CODE_RESPONSE.verification_uri_complete,
      );
      expect(result.current.status).toBe("waiting");
    });

    it("polls /device/token at the server interval while pending", async () => {
      const { useDeviceAuthorization } = await import("./authenticationHooks");
      renderHook(() => useDeviceAuthorization(), { wrapper: createWrapper() });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(mockPollDeviceToken).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockPollDeviceToken).toHaveBeenCalledTimes(1);
      expect(mockPollDeviceToken).toHaveBeenCalledWith("dev_123", "dj-site");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockPollDeviceToken).toHaveBeenCalledTimes(2);
    });

    it("increases the polling interval after a slow_down", async () => {
      mockPollDeviceToken
        .mockResolvedValueOnce({
          status: 400,
          body: { error: "slow_down", error_description: "Slow down" },
        })
        .mockResolvedValue({
          status: 400,
          body: {
            error: "authorization_pending",
            error_description: "Authorization pending",
          },
        });

      const { useDeviceAuthorization } = await import("./authenticationHooks");
      renderHook(() => useDeviceAuthorization(), { wrapper: createWrapper() });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // First poll fires at the 5s server interval and returns slow_down.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockPollDeviceToken).toHaveBeenCalledTimes(1);

      // 5s is no longer enough — the interval was bumped to 10s.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockPollDeviceToken).toHaveBeenCalledTimes(1);

      // 10s after the slow_down, the next poll fires.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockPollDeviceToken).toHaveBeenCalledTimes(2);
    });

    const SUCCESS_POLL = {
      status: 200,
      body: {
        access_token: "sess_abc",
        token_type: "Bearer",
        expires_in: 43200,
        scope: "",
      },
    };

    it("on success, derives the user via getSession and routes a complete DJ to the dashboard", async () => {
      mockPollDeviceToken.mockResolvedValue(SUCCESS_POLL);
      mockGetSession.mockResolvedValue({
        data: { user: { id: "dj-1", hasCompletedOnboarding: true } },
      });

      const { useDeviceAuthorization } = await import("./authenticationHooks");
      renderHook(() => useDeviceAuthorization(), { wrapper: createWrapper() });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(mockClearTokenCache).toHaveBeenCalled();
      expect(mockGetSession).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
      expect(mockSafeCapture).toHaveBeenCalledWith("login_post_redirect", {
        method: "qr",
        destination: "dashboard",
        has_completed_onboarding: true,
        user_id: "dj-1",
        session_confirmed: true,
      });
    });

    it("on success, routes an incomplete DJ to the onboarding screen", async () => {
      mockPollDeviceToken.mockResolvedValue(SUCCESS_POLL);
      mockGetSession.mockResolvedValue({
        data: { user: { id: "dj-2", hasCompletedOnboarding: false } },
      });

      const { useDeviceAuthorization } = await import("./authenticationHooks");
      renderHook(() => useDeviceAuthorization(), { wrapper: createWrapper() });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(mockPush).toHaveBeenCalledWith("/login?incomplete=true");
    });

    it.each([
      { httpStatus: 400, code: "expired_token", expected: "expired" },
      { httpStatus: 400, code: "access_denied", expected: "denied" },
      { httpStatus: 500, code: "server_error", expected: "error" },
    ])(
      "surfaces the '$expected' status on a terminal $code poll",
      async ({ httpStatus, code, expected }) => {
        mockPollDeviceToken.mockResolvedValue({
          status: httpStatus,
          body: { error: code, error_description: "terminal" },
        });

        const { useDeviceAuthorization } = await import("./authenticationHooks");
        const { result } = renderHook(() => useDeviceAuthorization(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });

        expect(result.current.status).toBe(expected);

        // A terminal state stops the loop — no further polls.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30000);
        });
        expect(mockPollDeviceToken).toHaveBeenCalledTimes(1);
      },
    );

    it("stops polling after unmount", async () => {
      const { useDeviceAuthorization } = await import("./authenticationHooks");
      const { unmount } = renderHook(() => useDeviceAuthorization(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });

      expect(mockPollDeviceToken).not.toHaveBeenCalled();
    });

    it("restart fetches a fresh device code and resumes from 'loading'", async () => {
      mockPollDeviceToken.mockResolvedValue({
        status: 400,
        body: { error: "expired_token", error_description: "expired" },
      });

      const { useDeviceAuthorization } = await import("./authenticationHooks");
      const { result } = renderHook(() => useDeviceAuthorization(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(result.current.status).toBe("expired");
      expect(mockRequestDeviceCode).toHaveBeenCalledTimes(1);

      mockPollDeviceToken.mockResolvedValue({
        status: 400,
        body: {
          error: "authorization_pending",
          error_description: "Authorization pending",
        },
      });

      await act(async () => {
        result.current.restart();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(mockRequestDeviceCode).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe("waiting");
    });

    it("still navigates when the post-success getSession read rejects, instead of stalling", async () => {
      mockPollDeviceToken.mockResolvedValue(SUCCESS_POLL);
      // Both the hook's own user read and confirmSessionVisible's read reject.
      mockGetSession.mockRejectedValue(new Error("network"));

      const { useDeviceAuthorization } = await import("./authenticationHooks");
      const { result } = renderHook(() => useDeviceAuthorization(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // Fire the success poll, then drain redirectAfterAuth's confirm-gate
      // retries (which also see the rejecting getSession).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });

      // Auth already succeeded (the poll set the cookie); the flow must not
      // freeze on "waiting". With no readable user and an unconfirmable
      // session, redirectAfterAuth falls back to refresh() rather than
      // stranding the DJ.
      expect(mockClearTokenCache).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("defaults to a 5s poll interval when the server omits `interval`", async () => {
      // A missing `interval` must not become NaN and make setTimeout fire at
      // 0ms, flooding the token endpoint.
      mockRequestDeviceCode.mockResolvedValue({
        ...DEVICE_CODE_RESPONSE,
        interval: undefined,
      });

      const { useDeviceAuthorization } = await import("./authenticationHooks");
      renderHook(() => useDeviceAuthorization(), { wrapper: createWrapper() });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // No busy-loop: nothing polls before the 5s default elapses.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4999);
      });
      expect(mockPollDeviceToken).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(mockPollDeviceToken).toHaveBeenCalledTimes(1);
    });

    it("surfaces the 'error' status when a poll throws (network failure)", async () => {
      mockPollDeviceToken.mockRejectedValue(new Error("network down"));

      const { useDeviceAuthorization } = await import("./authenticationHooks");
      const { result } = renderHook(() => useDeviceAuthorization(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(result.current.status).toBe("error");
    });
  });
});
