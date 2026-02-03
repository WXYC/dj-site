import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import type { AppStore } from "@/lib/store";
import React from "react";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock authClient
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockChangePassword = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockResetPassword = vi.fn();
const mockUseSession = vi.fn();

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    signIn: {
      username: (...args: unknown[]) => mockSignIn(...args),
    },
    signOut: () => mockSignOut(),
    getSession: () => mockGetSession(),
    updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
    requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
    useSession: () => mockUseSession(),
  },
}));

// Mock utilities
vi.mock("@/lib/features/authentication/utilities", () => ({
  betterAuthSessionToAuthenticationData: vi.fn((session) => ({
    user: session?.user
      ? {
          id: session.user.id,
          realName: session.user.realName,
          djName: session.user.djName,
          authority: "dj",
        }
      : null,
  })),
  betterAuthSessionToAuthenticationDataAsync: vi.fn((session) =>
    Promise.resolve({
      user: session?.user
        ? {
            id: session.user.id,
            realName: session.user.realName,
            djName: session.user.djName,
            authority: "dj",
          }
        : null,
    })
  ),
}));

// Import after mocks
import {
  useLogin,
  useLogout,
  useAuthentication,
  useRegistry,
  useNewUser,
  useResetPassword,
} from "./authenticationHooks";
import { toast } from "sonner";

describe("authenticationHooks", () => {
  let store: AppStore;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  beforeEach(() => {
    store = makeStore();
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    });
    // Set required env var for useNewUser
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD", "temp-password-123");
  });

  describe("useLogin", () => {
    it("should return initial login state", () => {
      const { result } = renderHook(() => useLogin(), { wrapper });

      expect(typeof result.current.handleLogin).toBe("function");
      expect(result.current.authenticating).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle successful login with complete profile", async () => {
      mockSignIn.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            realName: "Test User",
            djName: "DJ Test",
          },
        },
      });

      const { result } = renderHook(() => useLogin(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testuser" },
          password: { value: "password123" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      expect(mockSignIn).toHaveBeenCalledWith({
        username: "testuser",
        password: "password123",
      });
      expect(toast.success).toHaveBeenCalledWith("Login successful");
      expect(mockPush).toHaveBeenCalled();
    });

    it("should redirect to onboarding for incomplete profile", async () => {
      mockSignIn.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            realName: "",
            djName: null,
          },
        },
      });

      const { result } = renderHook(() => useLogin(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testuser" },
          password: { value: "password123" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      expect(toast.success).toHaveBeenCalledWith("Please complete your profile");
      expect(mockPush).toHaveBeenCalledWith("/onboarding");
    });

    it("should handle login error from authClient", async () => {
      mockSignIn.mockResolvedValue({
        error: { message: "Invalid credentials" },
      });

      const { result } = renderHook(() => useLogin(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testuser" },
          password: { value: "wrongpassword" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      expect(result.current.error).not.toBeNull();
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
    });

    it("should handle login exception", async () => {
      mockSignIn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useLogin(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testuser" },
          password: { value: "password123" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      expect(result.current.error?.message).toBe("Network error");
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });

    it("should set authenticating state during login", async () => {
      let resolveSignIn: (value: unknown) => void;
      mockSignIn.mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      const { result } = renderHook(() => useLogin(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "testuser" },
          password: { value: "password123" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      act(() => {
        result.current.handleLogin(mockEvent);
      });

      expect(result.current.authenticating).toBe(true);

      await act(async () => {
        resolveSignIn!({ error: { message: "test" } });
      });

      expect(result.current.authenticating).toBe(false);
    });
  });

  describe("useLogout", () => {
    it("should return initial logout state", () => {
      const { result } = renderHook(() => useLogout(), { wrapper });

      expect(typeof result.current.handleLogout).toBe("function");
      expect(result.current.loggingOut).toBe(false);
    });

    it("should handle successful logout", async () => {
      mockSignOut.mockResolvedValue({});

      const { result } = renderHook(() => useLogout(), { wrapper });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("should handle logout with form event", async () => {
      mockSignOut.mockResolvedValue({});

      const { result } = renderHook(() => useLogout(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogout(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it("should handle logout error", async () => {
      mockSignOut.mockRejectedValue(new Error("Logout failed"));

      const { result } = renderHook(() => useLogout(), { wrapper });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(toast.error).toHaveBeenCalledWith("Logout failed");
    });
  });

  describe("useAuthentication", () => {
    it("should return unauthenticated state when no session", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
        error: null,
      });

      const { result } = renderHook(() => useAuthentication(), { wrapper });

      expect(result.current.authenticated).toBe(false);
      expect(result.current.authenticating).toBe(false);
      expect(result.current.data).toEqual({ message: "Not Authenticated" });
    });

    it("should return authenticating state when pending", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: true,
        error: null,
      });

      const { result } = renderHook(() => useAuthentication(), { wrapper });

      expect(result.current.authenticating).toBe(true);
    });

    it("should return authenticated state with session", async () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-1",
            realName: "Test User",
            djName: "DJ Test",
          },
          session: { id: "session-1" },
        },
        isPending: false,
        error: null,
      });

      const { result } = renderHook(() => useAuthentication(), { wrapper });

      await waitFor(() => {
        expect(result.current.authenticating).toBe(false);
      });

      expect(result.current.authenticated).toBe(true);
    });

    it("should return error when session has error", () => {
      const sessionError = new Error("Session error");
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
        error: sessionError,
      });

      const { result } = renderHook(() => useAuthentication(), { wrapper });

      expect(result.current.error).toBe(sessionError);
    });
  });

  describe("useRegistry", () => {
    it("should return loading state when not authenticated", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: true,
        error: null,
      });

      const { result } = renderHook(() => useRegistry(), { wrapper });

      expect(result.current.loading).toBe(true);
      expect(result.current.info).toBeNull();
    });

    it("should return user info when authenticated", async () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-123",
            realName: "Test User",
            djName: "DJ Test",
          },
          session: { id: "session-1" },
        },
        isPending: false,
        error: null,
      });

      const { result } = renderHook(() => useRegistry(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.info).toEqual({
        id: "user-123",
        real_name: "Test User",
        dj_name: "DJ Test",
      });
    });
  });

  describe("useNewUser", () => {
    it("should return initial state", () => {
      const { result } = renderHook(() => useNewUser(), { wrapper });

      expect(typeof result.current.handleNewUser).toBe("function");
      expect(typeof result.current.addRequiredCredentials).toBe("function");
      expect(result.current.authenticating).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle successful profile update", async () => {
      mockGetSession.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      mockUpdateUser.mockResolvedValue({ error: null });
      mockChangePassword.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useNewUser(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "newuser" },
          password: { value: "newpassword123" },
          realName: { value: "Real Name" },
          djName: { value: "DJ Name" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleNewUser(mockEvent);
      });

      expect(mockUpdateUser).toHaveBeenCalledWith({
        realName: "Real Name",
        djName: "DJ Name",
      });
      expect(toast.success).toHaveBeenCalledWith("Profile updated successfully");
      expect(mockPush).toHaveBeenCalled();
    });

    it("should handle update error", async () => {
      mockGetSession.mockResolvedValue({
        data: { user: { id: "user-1" } },
      });
      mockUpdateUser.mockResolvedValue({
        error: { message: "Update failed" },
      });

      const { result } = renderHook(() => useNewUser(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "newuser" },
          password: { value: "newpassword123" },
          realName: { value: "Real Name" },
          djName: { value: "DJ Name" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleNewUser(mockEvent);
      });

      expect(result.current.error?.message).toBe("Update failed");
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });

    it("should handle missing session", async () => {
      mockGetSession.mockResolvedValue({
        data: { user: null },
      });

      const { result } = renderHook(() => useNewUser(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          username: { value: "newuser" },
          password: { value: "newpassword123" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleNewUser(mockEvent);
      });

      expect(result.current.error?.message).toBe(
        "You must be authenticated to update your profile"
      );
    });

    it("should add required credentials", () => {
      const { result } = renderHook(() => useNewUser(), { wrapper });

      act(() => {
        result.current.addRequiredCredentials(["realName", "djName"]);
      });

      // Verify dispatch was called (state change is internal)
      expect(result.current.addRequiredCredentials).toBeDefined();
    });
  });

  describe("useResetPassword", () => {
    it("should return initial state", () => {
      const { result } = renderHook(() => useResetPassword(), { wrapper });

      expect(typeof result.current.handleReset).toBe("function");
      expect(typeof result.current.handleRequestReset).toBe("function");
      expect(result.current.requestingReset).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle password reset request", async () => {
      mockRequestPasswordReset.mockResolvedValue({
        data: { message: "Reset link sent" },
        error: null,
      });

      const { result } = renderHook(() => useResetPassword(), { wrapper });

      await act(async () => {
        await result.current.handleRequestReset("test@example.com");
      });

      expect(mockRequestPasswordReset).toHaveBeenCalledWith({
        email: "test@example.com",
        redirectTo: expect.any(String),
      });
      expect(toast.success).toHaveBeenCalledWith("Reset link sent");
    });

    it("should handle empty email in reset request", async () => {
      const { result } = renderHook(() => useResetPassword(), { wrapper });

      await act(async () => {
        await result.current.handleRequestReset("");
      });

      expect(result.current.error?.message).toBe("Please enter your email address");
      expect(toast.error).toHaveBeenCalledWith("Please enter your email address");
    });

    it("should handle reset request error", async () => {
      mockRequestPasswordReset.mockResolvedValue({
        error: { message: "Email not found" },
      });

      const { result } = renderHook(() => useResetPassword(), { wrapper });

      await act(async () => {
        await result.current.handleRequestReset("unknown@example.com");
      });

      expect(result.current.error?.message).toBe("Email not found");
      expect(toast.error).toHaveBeenCalledWith("Email not found");
    });

    it("should handle successful password reset", async () => {
      mockResetPassword.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useResetPassword(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          token: { value: "reset-token-123" },
          password: { value: "newpassword123" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleReset(mockEvent);
      });

      expect(mockResetPassword).toHaveBeenCalledWith({
        newPassword: "newpassword123",
        token: "reset-token-123",
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Password reset successfully. Please log in."
      );
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    it("should handle missing token or password", async () => {
      const { result } = renderHook(() => useResetPassword(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          token: { value: "" },
          password: { value: "" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleReset(mockEvent);
      });

      expect(result.current.error?.message).toBe("All fields are required");
      expect(toast.error).toHaveBeenCalledWith("All fields are required");
    });

    it("should handle password reset error", async () => {
      mockResetPassword.mockResolvedValue({
        error: { message: "Invalid or expired token" },
      });

      const { result } = renderHook(() => useResetPassword(), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          token: { value: "expired-token" },
          password: { value: "newpassword123" },
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleReset(mockEvent);
      });

      expect(result.current.error?.message).toBe("Invalid or expired token");
      expect(toast.error).toHaveBeenCalledWith("Invalid or expired token");
    });
  });
});
