import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
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

// Mock authClient
const mockUpdateUser = vi.fn();
const mockChangePassword = vi.fn();
const mockGetSession = vi.fn();
const mockSignInUsername = vi.fn();
const mockSignInEmailOtp = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    updateUser: (...args: any[]) => mockUpdateUser(...args),
    changePassword: (...args: any[]) => mockChangePassword(...args),
    getSession: (...args: any[]) => mockGetSession(...args),
    signIn: {
      username: (...args: any[]) => mockSignInUsername(...args),
      emailOtp: (...args: any[]) => mockSignInEmailOtp(...args),
    },
    signOut: vi.fn(),
  },
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
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store, children });
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
  });
});
