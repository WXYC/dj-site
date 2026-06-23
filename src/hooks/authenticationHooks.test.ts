import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { authenticationSlice } from "@/lib/features/authentication/frontend";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
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
    process.env.NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD = "temp123";
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = "/dashboard/flowsheet";
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
      });
    });

    it("should redirect to dashboard when hasCompletedOnboarding is undefined (backward compat)", async () => {
      mockSignInUsername.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            realName: "Test User",
            djName: "DJ Test",
            // hasCompletedOnboarding not present — backend hasn't been updated yet
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
        has_completed_onboarding: null,
        user_id: "user-1",
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
      });
    });
  });

  describe("useNewUser", () => {
    it("should include hasCompletedOnboarding: true in updateUser call", async () => {
      mockGetSession.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      mockUpdateUser.mockResolvedValue({ data: {} });
      mockChangePassword.mockResolvedValue({ data: {} });

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

      expect(mockUpdateUser).toHaveBeenCalledWith({
        hasCompletedOnboarding: true,
        realName: "Real Name",
        djName: "DJ Name",
      });
    });

    it("redirects to the dashboard and captures the onboarding redirect on success", async () => {
      mockGetSession.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      mockUpdateUser.mockResolvedValue({ data: {} });
      mockChangePassword.mockResolvedValue({ data: {} });

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

      expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet");
      expect(mockSafeCapture).toHaveBeenCalledWith("login_post_redirect", {
        method: "onboarding",
        destination: "dashboard",
        has_completed_onboarding: true,
        user_id: "user-1",
      });
    });

    it("should set hasCompletedOnboarding even when profile fields are already filled", async () => {
      mockGetSession.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      mockUpdateUser.mockResolvedValue({ data: {} });
      mockChangePassword.mockResolvedValue({ data: {} });

      const { useNewUser } = await import("./authenticationHooks");
      const { result } = renderHook(() => useNewUser(), { wrapper: createWrapper() });

      // Simulate form where realName/djName inputs don't exist (admin pre-filled them)
      const form = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testdj" },
          password: { value: "NewPassword1" },
          realName: undefined,
          djName: undefined,
        },
      } as any;

      await act(async () => {
        await result.current.handleNewUser(form);
      });

      expect(mockUpdateUser).toHaveBeenCalledWith({
        hasCompletedOnboarding: true,
      });
    });

    it("calls changePassword before updateUser so a failed password change leaves hasCompletedOnboarding untouched", async () => {
      mockGetSession.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });

      const callOrder: string[] = [];
      mockChangePassword.mockImplementation(async () => {
        callOrder.push("changePassword");
        return { data: {} };
      });
      mockUpdateUser.mockImplementation(async () => {
        callOrder.push("updateUser");
        return { data: {} };
      });

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

      expect(callOrder).toEqual(["changePassword", "updateUser"]);
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: "temp123",
        newPassword: "NewPassword1",
      });
    });

    it("does not call updateUser when changePassword rejects, so hasCompletedOnboarding stays false", async () => {
      mockGetSession.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      mockChangePassword.mockResolvedValue({
        data: null,
        error: { message: "Current password is incorrect" },
      });

      const { throwIfBetterAuthError } = await import("@/src/utilities/throwIfBetterAuthError");
      (throwIfBetterAuthError as any).mockImplementation((res: any, msg: string) => {
        if (res?.error) {
          throw new Error(msg);
        }
      });

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

      expect(mockChangePassword).toHaveBeenCalled();
      expect(mockUpdateUser).not.toHaveBeenCalled();
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
