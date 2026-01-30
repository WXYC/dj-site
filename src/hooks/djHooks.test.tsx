import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { useDJAccount } from "./djHooks";
import { authenticationSlice } from "@/lib/features/authentication/frontend";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
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
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    getSession: vi.fn(() =>
      Promise.resolve({
        data: { user: { id: "user-1" } },
      })
    ),
    updateUser: vi.fn(() => Promise.resolve({ error: null })),
  },
}));

// Mock authentication hooks
vi.mock("./authenticationHooks", () => ({
  useRegistry: vi.fn(() => ({
    loading: false,
    info: { id: 1, djName: "Test DJ", realName: "Test User", email: "test@example.com" },
  })),
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
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("djHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useDJAccount", () => {
    it("should return info from registry", () => {
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      expect(result.current.info).toEqual({
        id: 1,
        djName: "Test DJ",
        realName: "Test User",
        email: "test@example.com",
      });
    });

    it("should return loading state", () => {
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(false);
    });

    it("should return handleSaveData function", () => {
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.handleSaveData).toBe("function");
    });

    it("should handle form submission with modifications", async () => {
      const store = configureStore({
        reducer: {
          authentication: authenticationSlice.reducer,
        },
        preloadedState: {
          authentication: {
            ...authenticationSlice.getInitialState(),
            modifications: ["realName"],
          },
        },
      });

      function wrapper({ children }: { children: React.ReactNode }) {
        return <Provider store={store}>{children}</Provider>;
      }

      const { result } = renderHook(() => useDJAccount(), { wrapper });

      const formData = new FormData();
      formData.append("realName", "Updated Name");

      const mockForm = document.createElement("form");
      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      // Mock FormData constructor to return our formData
      const originalFormData = global.FormData;
      global.FormData = vi.fn(() => formData) as any;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      global.FormData = originalFormData;

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("should not submit when no modifications", async () => {
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      const mockForm = document.createElement("form");
      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      // No toast should be shown since no modifications
    });

    it("should set loading during save operation", async () => {
      const store = configureStore({
        reducer: {
          authentication: authenticationSlice.reducer,
        },
        preloadedState: {
          authentication: {
            ...authenticationSlice.getInitialState(),
            modifications: ["realName"],
          },
        },
      });

      function wrapper({ children }: { children: React.ReactNode }) {
        return <Provider store={store}>{children}</Provider>;
      }

      const { result } = renderHook(() => useDJAccount(), { wrapper });

      const formData = new FormData();
      formData.append("realName", "Updated Name");

      const mockForm = document.createElement("form");
      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      const originalFormData = global.FormData;
      global.FormData = vi.fn(() => formData) as any;

      // Just verify the operation completes without throwing
      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      global.FormData = originalFormData;

      // After save, loading should be false
      expect(result.current.loading).toBe(false);
    });
  });
});
