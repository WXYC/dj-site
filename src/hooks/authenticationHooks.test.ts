import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { applicationSlice } from "@/lib/features/application/frontend";
import { createHookWrapper } from "@/lib/test-utils";

// Use vi.hoisted for variables used in vi.mock
const {
  mockPush,
  mockRefresh,
  mockToastError,
  mockToastSuccess,
  mockSignIn,
  mockSignOut,
  mockUseSession,
  mockGetSession,
  mockUpdateUser,
  mockChangePassword,
  mockRequestPasswordReset,
  mockResetPassword,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockUseSession: vi.fn(),
  mockGetSession: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockChangePassword: vi.fn(),
  mockRequestPasswordReset: vi.fn(),
  mockResetPassword: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

// Mock auth client
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    signIn: {
      username: (params: any) => mockSignIn(params),
    },
    signOut: () => mockSignOut(),
    useSession: () => mockUseSession(),
    getSession: () => mockGetSession(),
    updateUser: (params: any) => mockUpdateUser(params),
    changePassword: (params: any) => mockChangePassword(params),
    requestPasswordReset: (params: any) => mockRequestPasswordReset(params),
    resetPassword: (params: any) => mockResetPassword(params),
  },
}));

// Mock resetApplication
vi.mock("./applicationHooks", () => ({
  resetApplication: vi.fn(),
}));

// Import hooks after mocks
import {
  useLogin,
  useLogout,
  useAuthentication,
  useRegistry,
  useNewUser,
  useResetPassword,
} from "./authenticationHooks";
import { resetApplication } from "./applicationHooks";

const createWrapper = () =>
  createHookWrapper({
    authentication: authenticationSlice,
    application: applicationSlice,
  });

// Helper to create mock form with named input elements
// The form.username syntax accesses elements by name through the form's named access
function createMockForm(fields: Record<string, string>): HTMLFormElement {
  const form = document.createElement("form");
  document.body.appendChild(form);

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.name = name;
    input.value = value;
    form.appendChild(input);
    // Add named property access to the form (form.elements.namedItem is used internally)
    Object.defineProperty(form, name, {
      value: input,
      configurable: true,
      enumerable: false,
    });
  }

  return form;
}

function cleanupForm(form: HTMLFormElement): void {
  if (form.parentNode) {
    form.parentNode.removeChild(form);
  }
}

describe("authenticationHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default session mock
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
    });
    mockSignIn.mockResolvedValue({});
    mockSignOut.mockResolvedValue({});
    mockUpdateUser.mockResolvedValue({});
    mockChangePassword.mockResolvedValue({});
    mockRequestPasswordReset.mockResolvedValue({ data: { message: "Check your email" } });
    mockResetPassword.mockResolvedValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("useLogin", () => {
    it("should return handleLogin function", () => {
      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.handleLogin).toBe("function");
    });

    it("should return verified state", () => {
      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.verified).toBe("boolean");
    });

    it("should return authenticating state", () => {
      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      expect(result.current.authenticating).toBe(false);
    });

    it("should return error as null initially", () => {
      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeNull();
    });

    it("should handle successful login", async () => {
      mockSignIn.mockResolvedValue({});

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "testuser",
        password: "testpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      cleanupForm(mockForm);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockSignIn).toHaveBeenCalledWith({
        username: "testuser",
        password: "testpass",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Login successful");
      expect(mockPush).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("should handle login error with Error object", async () => {
      mockSignIn.mockResolvedValue({
        error: new Error("Invalid credentials"),
      });

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "testuser",
        password: "wrongpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      cleanupForm(mockForm);

      expect(result.current.error).not.toBeNull();
      expect(mockToastError).toHaveBeenCalledWith("Invalid credentials");
    });

    it("should handle login error with string message", async () => {
      mockSignIn.mockResolvedValue({
        error: "Login failed",
      });

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "testuser",
        password: "wrongpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      cleanupForm(mockForm);

      expect(mockToastError).toHaveBeenCalledWith("Login failed");
    });

    it("should handle login error with object containing message", async () => {
      mockSignIn.mockResolvedValue({
        error: { message: "Account locked" },
      });

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "testuser",
        password: "wrongpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      cleanupForm(mockForm);

      expect(mockToastError).toHaveBeenCalledWith("Account locked");
    });

    it("should handle login exception", async () => {
      mockSignIn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "testuser",
        password: "testpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      cleanupForm(mockForm);

      expect(result.current.error).not.toBeNull();
      expect(mockToastError).toHaveBeenCalledWith("Network error");
    });

    it("should handle non-Error exception", async () => {
      mockSignIn.mockRejectedValue("String error");

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "testuser",
        password: "testpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      cleanupForm(mockForm);

      expect(result.current.error).not.toBeNull();
    });

    it("should set authenticating to true during login", async () => {
      let resolveSignIn: () => void;
      mockSignIn.mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = () => resolve({});
        })
      );

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "testuser",
        password: "testpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      act(() => {
        result.current.handleLogin(mockEvent);
      });

      expect(result.current.authenticating).toBe(true);

      await act(async () => {
        resolveSignIn!();
      });

      cleanupForm(mockForm);

      expect(result.current.authenticating).toBe(false);
    });

    it("should not show toast for empty error messages", async () => {
      // When error message is only whitespace, the toast should not be called
      // Looking at the code: if (errorMessage.trim().length > 0) { toast.error(errorMessage); }
      mockSignIn.mockResolvedValue({
        error: { message: "   " },
      });

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "testuser",
        password: "wrongpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogin(mockEvent);
      });

      cleanupForm(mockForm);

      // When the error message is only whitespace, toast.error should NOT be called
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe("useLogout", () => {
    it("should return handleLogout function", () => {
      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.handleLogout).toBe("function");
    });

    it("should return loggingOut state", () => {
      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loggingOut).toBe(false);
    });

    it("should handle successful logout", async () => {
      mockSignOut.mockResolvedValue({});

      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
      expect(resetApplication).toHaveBeenCalled();
    });

    it("should handle logout with form event", async () => {
      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleLogout(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("should handle logout error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockSignOut.mockRejectedValue(new Error("Logout failed"));

      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockToastError).toHaveBeenCalledWith("Logout failed");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle non-Error logout exception", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockSignOut.mockRejectedValue("String error");

      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockToastError).toHaveBeenCalledWith("Failed to logout. Please try again.");
      consoleSpy.mockRestore();
    });
  });

  describe("useAuthentication", () => {
    it("should return unauthenticated state when no session", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
        error: null,
      });

      const { result } = renderHook(() => useAuthentication(), {
        wrapper: createWrapper(),
      });

      expect(result.current.authenticated).toBe(false);
      expect(result.current.authenticating).toBe(false);
      expect(result.current.data).toEqual({ message: "Not Authenticated" });
    });

    it("should return pending state when loading", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: true,
        error: null,
      });

      const { result } = renderHook(() => useAuthentication(), {
        wrapper: createWrapper(),
      });

      expect(result.current.authenticating).toBe(true);
    });

    it("should return authenticated state with session", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            username: "testuser",
            realName: "Test User",
            djName: "DJ Test",
            role: "dj",
          },
          session: {
            token: "test-token",
          },
        },
        isPending: false,
        error: null,
      });

      const { result } = renderHook(() => useAuthentication(), {
        wrapper: createWrapper(),
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

      const { result } = renderHook(() => useAuthentication(), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(sessionError);
    });
  });

  describe("useRegistry", () => {
    it("should return loading true when authenticating", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: true,
        error: null,
      });

      const { result } = renderHook(() => useRegistry(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
    });

    it("should return null info when not authenticated", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
        error: null,
      });

      const { result } = renderHook(() => useRegistry(), {
        wrapper: createWrapper(),
      });

      expect(result.current.info).toBeNull();
    });

    it("should return user info when authenticated", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            username: "testuser",
            realName: "Test User",
            djName: "DJ Test",
            role: "dj",
          },
          session: {
            token: "test-token",
          },
        },
        isPending: false,
        error: null,
      });

      const { result } = renderHook(() => useRegistry(), {
        wrapper: createWrapper(),
      });

      expect(result.current.info).toEqual({
        id: "test-user-id",
        real_name: "Test User",
        dj_name: "DJ Test",
      });
    });

    it("should handle missing optional fields gracefully", () => {
      // Note: If realName or djName is missing, the betterAuthSessionToAuthenticationData
      // function returns an IncompleteUser, which is not authenticated.
      // So we need to provide at least the required fields to get user info.
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            name: "testuser",
            username: "testuser",
            emailVerified: true,
            // Missing realName and djName makes user incomplete
            role: "dj",
          },
          session: {
            id: "session-id",
            userId: "test-user-id",
            expiresAt: new Date(),
            token: "test-token",
          },
        },
        isPending: false,
        error: null,
      });

      const { result } = renderHook(() => useRegistry(), {
        wrapper: createWrapper(),
      });

      // Since realName/djName are missing, user is treated as incomplete
      // and isAuthenticated returns false, so info should be null
      expect(result.current.info).toBeNull();
      expect(result.current.loading).toBe(true); // Not authenticated means still loading
    });
  });

  describe("useNewUser", () => {
    it("should return handleNewUser function", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: "test-user-id" },
          session: {},
        },
        isPending: false,
        error: null,
      });

      const { result } = renderHook(() => useNewUser(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.handleNewUser).toBe("function");
    });

    it("should return verified state", () => {
      const { result } = renderHook(() => useNewUser(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.verified).toBe("boolean");
    });

    it("should return addRequiredCredentials function", () => {
      const { result } = renderHook(() => useNewUser(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.addRequiredCredentials).toBe("function");
    });

    it("should handle successful profile update", async () => {
      vi.stubEnv("NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD", "temppass");

      mockGetSession.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      });
      mockUpdateUser.mockResolvedValue({});
      mockChangePassword.mockResolvedValue({});

      const { result } = renderHook(() => useNewUser(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "newuser",
        password: "newpass",
        realName: "New User",
        djName: "DJ New",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleNewUser(mockEvent);
      });

      cleanupForm(mockForm);

      expect(mockUpdateUser).toHaveBeenCalledWith({
        realName: "New User",
        djName: "DJ New",
      });
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: "temppass",
        newPassword: "newpass",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Profile updated successfully");
      expect(mockPush).toHaveBeenCalled();

      vi.unstubAllEnvs();
    });

    it("should handle missing temp password config", async () => {
      vi.stubEnv("NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD", "");

      const { result } = renderHook(() => useNewUser(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "newuser",
        password: "newpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await expect(
        act(async () => {
          await result.current.handleNewUser(mockEvent);
        })
      ).rejects.toThrow("Missing onboarding temp password configuration");

      cleanupForm(mockForm);
      vi.unstubAllEnvs();
    });

    it("should handle unauthenticated user", async () => {
      vi.stubEnv("NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD", "temppass");

      mockGetSession.mockResolvedValue({
        data: { user: null },
      });

      const { result } = renderHook(() => useNewUser(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "newuser",
        password: "newpass",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleNewUser(mockEvent);
      });

      cleanupForm(mockForm);

      expect(result.current.error?.message).toBe(
        "You must be authenticated to update your profile"
      );

      vi.unstubAllEnvs();
    });

    it("should handle updateUser error", async () => {
      vi.stubEnv("NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD", "temppass");

      mockGetSession.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      });
      mockUpdateUser.mockResolvedValue({
        error: { message: "Update failed" },
      });

      const { result } = renderHook(() => useNewUser(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "newuser",
        password: "newpass",
        realName: "New User",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleNewUser(mockEvent);
      });

      cleanupForm(mockForm);

      expect(result.current.error?.message).toBe("Update failed");
      expect(mockToastError).toHaveBeenCalledWith("Update failed");

      vi.unstubAllEnvs();
    });

    it("should handle changePassword error", async () => {
      vi.stubEnv("NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD", "temppass");

      mockGetSession.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      });
      mockUpdateUser.mockResolvedValue({});
      mockChangePassword.mockResolvedValue({
        error: { message: "Password change failed" },
      });

      const { result } = renderHook(() => useNewUser(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "newuser",
        password: "newpass",
        realName: "New User",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleNewUser(mockEvent);
      });

      cleanupForm(mockForm);

      expect(result.current.error?.message).toBe("Password change failed");

      vi.unstubAllEnvs();
    });

    it("should handle profile update without password change", async () => {
      vi.stubEnv("NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD", "temppass");

      mockGetSession.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      });
      mockUpdateUser.mockResolvedValue({});

      const { result } = renderHook(() => useNewUser(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({
        username: "newuser",
        password: "",
        realName: "New User",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleNewUser(mockEvent);
      });

      cleanupForm(mockForm);

      expect(mockChangePassword).not.toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalled();

      vi.unstubAllEnvs();
    });
  });

  describe("useResetPassword", () => {
    it("should return handleReset function", () => {
      const { result } = renderHook(() => useResetPassword(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.handleReset).toBe("function");
    });

    it("should return handleRequestReset function", () => {
      const { result } = renderHook(() => useResetPassword(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.handleRequestReset).toBe("function");
    });

    it("should return verified state", () => {
      const { result } = renderHook(() => useResetPassword(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.verified).toBe("boolean");
    });

    it("should return requestingReset state", () => {
      const { result } = renderHook(() => useResetPassword(), {
        wrapper: createWrapper(),
      });

      expect(result.current.requestingReset).toBe(false);
    });

    describe("handleRequestReset", () => {
      it("should show error for empty email", async () => {
        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.handleRequestReset("");
        });

        expect(result.current.error?.message).toBe("Please enter your email address");
        expect(mockToastError).toHaveBeenCalledWith("Please enter your email address");
      });

      it("should handle successful password reset request", async () => {
        mockRequestPasswordReset.mockResolvedValue({
          data: { message: "Check your email for reset link" },
        });

        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.handleRequestReset("test@example.com");
        });

        expect(mockRequestPasswordReset).toHaveBeenCalled();
        expect(mockToastSuccess).toHaveBeenCalledWith("Check your email for reset link");
        expect(mockPush).toHaveBeenCalledWith("/login");
      });

      it("should handle password reset request error", async () => {
        mockRequestPasswordReset.mockResolvedValue({
          error: { message: "Email not found" },
        });

        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.handleRequestReset("unknown@example.com");
        });

        expect(result.current.error?.message).toBe("Email not found");
        expect(mockToastError).toHaveBeenCalledWith("Email not found");
      });

      it("should handle password reset request exception", async () => {
        mockRequestPasswordReset.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.handleRequestReset("test@example.com");
        });

        expect(result.current.error?.message).toBe("Network error");
      });
    });

    describe("handleReset", () => {
      it("should show error for missing token or password", async () => {
        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        const mockForm = createMockForm({
          token: "",
          password: "",
        });

        const mockEvent = {
          preventDefault: vi.fn(),
          currentTarget: mockForm,
        } as unknown as React.FormEvent<HTMLFormElement>;

        await act(async () => {
          await result.current.handleReset(mockEvent);
        });

        cleanupForm(mockForm);

        expect(result.current.error?.message).toBe("All fields are required");
        expect(mockToastError).toHaveBeenCalledWith("All fields are required");
      });

      it("should handle successful password reset", async () => {
        mockResetPassword.mockResolvedValue({});

        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        const mockForm = createMockForm({
          token: "valid-token",
          password: "newpassword",
        });

        const mockEvent = {
          preventDefault: vi.fn(),
          currentTarget: mockForm,
        } as unknown as React.FormEvent<HTMLFormElement>;

        await act(async () => {
          await result.current.handleReset(mockEvent);
        });

        cleanupForm(mockForm);

        expect(mockResetPassword).toHaveBeenCalledWith({
          newPassword: "newpassword",
          token: "valid-token",
        });
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Password reset successfully. Please log in."
        );
        expect(mockPush).toHaveBeenCalledWith("/login");
        expect(mockRefresh).toHaveBeenCalled();
      });

      it("should handle password reset error", async () => {
        mockResetPassword.mockResolvedValue({
          error: { message: "Invalid or expired token" },
        });

        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        const mockForm = createMockForm({
          token: "expired-token",
          password: "newpassword",
        });

        const mockEvent = {
          preventDefault: vi.fn(),
          currentTarget: mockForm,
        } as unknown as React.FormEvent<HTMLFormElement>;

        await act(async () => {
          await result.current.handleReset(mockEvent);
        });

        cleanupForm(mockForm);

        expect(result.current.error?.message).toBe("Invalid or expired token");
        expect(mockToastError).toHaveBeenCalledWith("Invalid or expired token");
      });

      it("should handle password reset exception", async () => {
        mockResetPassword.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        const mockForm = createMockForm({
          token: "valid-token",
          password: "newpassword",
        });

        const mockEvent = {
          preventDefault: vi.fn(),
          currentTarget: mockForm,
        } as unknown as React.FormEvent<HTMLFormElement>;

        await act(async () => {
          await result.current.handleReset(mockEvent);
        });

        cleanupForm(mockForm);

        expect(result.current.error?.message).toBe("Network error");
      });

      it("should handle non-Error password reset exception", async () => {
        mockResetPassword.mockRejectedValue("String error");

        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        const mockForm = createMockForm({
          token: "valid-token",
          password: "newpassword",
        });

        const mockEvent = {
          preventDefault: vi.fn(),
          currentTarget: mockForm,
        } as unknown as React.FormEvent<HTMLFormElement>;

        await act(async () => {
          await result.current.handleReset(mockEvent);
        });

        cleanupForm(mockForm);

        expect(result.current.error?.message).toBe(
          "Password reset failed. Please try again."
        );
      });
    });
  });
});
