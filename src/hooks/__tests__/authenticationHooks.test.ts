import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Mock modules before importing the module under test
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    signIn: {
      username: vi.fn(),
    },
    signOut: vi.fn(),
    getSession: vi.fn(),
    useSession: vi.fn(() => ({
      data: null,
      isPending: false,
      error: null,
    })),
    updateUser: vi.fn(),
    changePassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock("@/lib/features/authentication/utilities", () => ({
  betterAuthSessionToAuthenticationData: vi.fn(() => ({
    message: "Not Authenticated",
  })),
  betterAuthSessionToAuthenticationDataAsync: vi.fn(() =>
    Promise.resolve({ message: "Not Authenticated" })
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockDispatch = vi.fn();
vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(() => false),
}));

vi.mock("../applicationHooks", () => ({
  resetApplication: vi.fn(),
}));

vi.mock("@/lib/features/authentication/frontend", () => ({
  authenticationSlice: {
    actions: {
      reset: vi.fn(() => ({ type: "auth/reset" })),
      addRequiredCredentials: vi.fn((creds) => ({
        type: "auth/addRequiredCredentials",
        payload: creds,
      })),
    },
    selectors: {
      allCredentialsVerified: vi.fn(() => false),
      requiredCredentialsVerified: vi.fn(() => false),
    },
  },
}));

vi.mock("@/lib/features/application/frontend", () => ({
  applicationSlice: {
    actions: {
      setAuthStage: vi.fn((stage) => ({
        type: "app/setAuthStage",
        payload: stage,
      })),
    },
  },
}));

import { authClient } from "@/lib/features/authentication/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Use type assertion for mocked functions
const mockedAuthClient = authClient as unknown as {
  signIn: { username: ReturnType<typeof vi.fn> };
  signOut: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
  useSession: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  changePassword: ReturnType<typeof vi.fn>;
  requestPasswordReset: ReturnType<typeof vi.fn>;
  resetPassword: ReturnType<typeof vi.fn>;
};
const mockedRouter = vi.mocked(useRouter);
const mockedToast = vi.mocked(toast);

describe("authenticationHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch.mockClear();

    // Reset router mock
    mockedRouter.mockReturnValue({
      push: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("useLogin - custom user fields handling", () => {
    it("should detect incomplete user when realName is missing", async () => {
      const mockPush = vi.fn();
      const mockRefresh = vi.fn();
      mockedRouter.mockReturnValue({
        push: mockPush,
        refresh: mockRefresh,
        back: vi.fn(),
        forward: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
      });

      // Mock successful sign-in
      mockedAuthClient.signIn.username.mockResolvedValue({
        data: { user: { id: "123" } },
      } as any);

      // Mock getSession returning a user without realName
      mockedAuthClient.getSession.mockResolvedValue({
        data: {
          user: {
            id: "123",
            email: "test@wxyc.org",
            name: "testuser",
            emailVerified: true,
            realName: null, // Missing realName
            djName: "DJ Test",
          },
          session: { id: "session-123", userId: "123", expiresAt: new Date() },
        },
      } as any);

      // Import hooks dynamically after mocks are set up
      const { useLogin } = await import("../authenticationHooks");

      const { result } = renderHook(() => useLogin());

      // Create mock form event
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

      // Should redirect to onboarding when profile is incomplete
      expect(mockPush).toHaveBeenCalledWith("/onboarding");
      expect(mockedToast.success).toHaveBeenCalledWith(
        "Please complete your profile"
      );
    });

    it("should detect incomplete user when djName is missing", async () => {
      const mockPush = vi.fn();
      const mockRefresh = vi.fn();
      mockedRouter.mockReturnValue({
        push: mockPush,
        refresh: mockRefresh,
        back: vi.fn(),
        forward: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
      });

      mockedAuthClient.signIn.username.mockResolvedValue({
        data: { user: { id: "123" } },
      } as any);

      // Mock getSession returning a user without djName
      mockedAuthClient.getSession.mockResolvedValue({
        data: {
          user: {
            id: "123",
            email: "test@wxyc.org",
            name: "testuser",
            emailVerified: true,
            realName: "Test User",
            djName: null, // Missing djName
          },
          session: { id: "session-123", userId: "123", expiresAt: new Date() },
        },
      } as any);

      const { useLogin } = await import("../authenticationHooks");

      const { result } = renderHook(() => useLogin());

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

      expect(mockPush).toHaveBeenCalledWith("/onboarding");
    });

    it("should detect incomplete user when realName is empty string", async () => {
      const mockPush = vi.fn();
      mockedRouter.mockReturnValue({
        push: mockPush,
        refresh: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
      });

      mockedAuthClient.signIn.username.mockResolvedValue({
        data: { user: { id: "123" } },
      } as any);

      // Mock getSession returning a user with empty realName
      mockedAuthClient.getSession.mockResolvedValue({
        data: {
          user: {
            id: "123",
            email: "test@wxyc.org",
            name: "testuser",
            emailVerified: true,
            realName: "   ", // Empty/whitespace realName
            djName: "DJ Test",
          },
          session: { id: "session-123", userId: "123", expiresAt: new Date() },
        },
      } as any);

      const { useLogin } = await import("../authenticationHooks");

      const { result } = renderHook(() => useLogin());

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

      expect(mockPush).toHaveBeenCalledWith("/onboarding");
    });

    it("should redirect to dashboard when profile is complete", async () => {
      const mockPush = vi.fn();
      mockedRouter.mockReturnValue({
        push: mockPush,
        refresh: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
      });

      mockedAuthClient.signIn.username.mockResolvedValue({
        data: { user: { id: "123" } },
      } as any);

      // Mock getSession returning a complete user profile
      mockedAuthClient.getSession.mockResolvedValue({
        data: {
          user: {
            id: "123",
            email: "test@wxyc.org",
            name: "testuser",
            emailVerified: true,
            realName: "Test User", // Has realName
            djName: "DJ Test", // Has djName
          },
          session: { id: "session-123", userId: "123", expiresAt: new Date() },
        },
      } as any);

      const { useLogin } = await import("../authenticationHooks");

      const { result } = renderHook(() => useLogin());

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

      // Should redirect to dashboard when profile is complete
      // Uses NEXT_PUBLIC_DASHBOARD_HOME_PAGE or defaults to /dashboard/catalog
      expect(mockPush).toHaveBeenCalledWith("/dashboard/catalog");
      expect(mockedToast.success).toHaveBeenCalledWith("Login successful");
    });

    it("should handle login error gracefully", async () => {
      mockedAuthClient.signIn.username.mockResolvedValue({
        error: { message: "Invalid credentials" },
      } as any);

      const { useLogin } = await import("../authenticationHooks");

      const { result } = renderHook(() => useLogin());

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

      expect(mockedToast.error).toHaveBeenCalledWith("Invalid credentials");
      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useLogout", () => {
    it("should call signOut and refresh router", async () => {
      const mockRefresh = vi.fn();
      mockedRouter.mockReturnValue({
        push: vi.fn(),
        refresh: mockRefresh,
        back: vi.fn(),
        forward: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
      });

      mockedAuthClient.signOut.mockResolvedValue({} as any);

      const { useLogout } = await import("../authenticationHooks");

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockedAuthClient.signOut).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
