import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useLogin,
  useLogout,
  useAuthentication,
  useRegistry,
  useNewUser,
  useResetPassword,
} from "./authenticationHooks";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { applicationSlice } from "@/lib/features/application/frontend";
import React from "react";

// Mock next/navigation
const mockRouter = {
  refresh: vi.fn(),
  push: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => mockRouter),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock authClient
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    signIn: {
      username: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    },
    signOut: vi.fn(() => Promise.resolve()),
    getSession: vi.fn(() =>
      Promise.resolve({
        data: {
          user: { id: "user-123", realName: "Test User", djName: "DJ Test" },
        },
      })
    ),
    updateUser: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    changePassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    requestPasswordReset: vi.fn(() =>
      Promise.resolve({ data: { message: "Email sent" }, error: null })
    ),
    resetPassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    useSession: vi.fn(() => ({
      data: {
        user: { id: "user-123", realName: "Test User", djName: "DJ Test" },
      },
      isPending: false,
      error: null,
    })),
  },
}));

// Mock utilities
vi.mock("@/lib/features/authentication/utilities", () => ({
  betterAuthSessionToAuthenticationData: vi.fn((session) => ({
    user: session?.user,
    authenticated: true,
  })),
  betterAuthSessionToAuthenticationDataAsync: vi.fn((session) =>
    Promise.resolve({
      user: session?.user,
      authenticated: true,
    })
  ),
}));

vi.mock("@/lib/features/authentication/types", () => ({
  isAuthenticated: vi.fn((data) => data?.authenticated === true),
  djAttributeNames: {},
}));

vi.mock("./applicationHooks", () => ({
  resetApplication: vi.fn(),
}));

function createTestStore() {
  return configureStore({
    reducer: {
      authentication: authenticationSlice.reducer,
      application: applicationSlice.reducer,
    },
  });
}

function Wrapper({ children, store }: { children: React.ReactNode; store: any }) {
  return React.createElement(Provider, { store }, children);
}

describe("authenticationHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useLogin", () => {
    it("should return handleLogin function", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useLogin(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.handleLogin).toBeDefined();
      expect(typeof result.current.handleLogin).toBe("function");
    });

    it("should return authenticating state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useLogin(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.authenticating).toBe(false);
    });

    it("should return error state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useLogin(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("useLogout", () => {
    it("should return handleLogout function", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useLogout(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.handleLogout).toBeDefined();
      expect(typeof result.current.handleLogout).toBe("function");
    });

    it("should return loggingOut state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useLogout(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.loggingOut).toBe(false);
    });

    it("should call signOut when handleLogout is called", async () => {
      const { authClient } = await import("@/lib/features/authentication/client");
      const store = createTestStore();

      const { result } = renderHook(() => useLogout(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(authClient.signOut).toHaveBeenCalled();
    });

    it("should refresh router after logout", async () => {
      const store = createTestStore();

      const { result } = renderHook(() => useLogout(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockRouter.refresh).toHaveBeenCalled();
    });
  });

  describe("useAuthentication", () => {
    it("should return authentication data", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useAuthentication(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.data).toBeDefined();
    });

    it("should return authenticating state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useAuthentication(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.authenticating).toBeDefined();
    });

    it("should return authenticated state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useAuthentication(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.authenticated).toBeDefined();
    });
  });

  describe("useRegistry", () => {
    it("should return loading state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useRegistry(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current).toHaveProperty("loading");
    });

    it("should return info property", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useRegistry(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current).toHaveProperty("info");
    });
  });

  describe("useNewUser", () => {
    it("should return handleNewUser function", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useNewUser(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.handleNewUser).toBeDefined();
      expect(typeof result.current.handleNewUser).toBe("function");
    });

    it("should return authenticating state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useNewUser(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.authenticating).toBe(false);
    });

    it("should return addRequiredCredentials function", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useNewUser(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.addRequiredCredentials).toBeDefined();
      expect(typeof result.current.addRequiredCredentials).toBe("function");
    });
  });

  describe("useResetPassword", () => {
    it("should return handleReset function", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useResetPassword(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.handleReset).toBeDefined();
      expect(typeof result.current.handleReset).toBe("function");
    });

    it("should return handleRequestReset function", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useResetPassword(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.handleRequestReset).toBeDefined();
      expect(typeof result.current.handleRequestReset).toBe("function");
    });

    it("should return requestingReset state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useResetPassword(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.requestingReset).toBe(false);
    });

    it("should return error state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useResetPassword(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.error).toBeNull();
    });
  });
});
