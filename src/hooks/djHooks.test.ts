import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDJAccount } from "./djHooks";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
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
    getSession: vi.fn(() =>
      Promise.resolve({
        data: {
          user: { id: "user-123" },
        },
      })
    ),
    updateUser: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  },
}));

// Mock authenticationHooks
vi.mock("./authenticationHooks", () => ({
  useRegistry: vi.fn(() => ({
    info: { id: 1, username: "testuser", realName: "Test User" },
    loading: false,
  })),
}));

function createTestStore(modifications: string[] = []) {
  return configureStore({
    reducer: {
      authentication: authenticationSlice.reducer,
    },
    preloadedState: {
      authentication: {
        ...authenticationSlice.getInitialState(),
        modifications,
      },
    },
  });
}

function Wrapper({ children, store }: { children: React.ReactNode; store: any }) {
  return React.createElement(Provider, { store }, children);
}

describe("djHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useDJAccount", () => {
    it("should return info from registry", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useDJAccount(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.info).toEqual({
        id: 1,
        username: "testuser",
        realName: "Test User",
      });
    });

    it("should return loading state", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useDJAccount(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.loading).toBe(false);
    });

    it("should return handleSaveData function", () => {
      const store = createTestStore();

      const { result } = renderHook(() => useDJAccount(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.handleSaveData).toBeDefined();
      expect(typeof result.current.handleSaveData).toBe("function");
    });

    it("should show loading when registry is loading", async () => {
      const { useRegistry } = await import("./authenticationHooks");
      vi.mocked(useRegistry).mockReturnValue({
        info: { id: 1, username: "testuser" },
        loading: true,
      } as any);

      const store = createTestStore();

      const { result } = renderHook(() => useDJAccount(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      expect(result.current.loading).toBe(true);
    });

    it("should handle form submission with modifications", async () => {
      const { toast } = await import("sonner");
      const store = createTestStore(["realName", "djName"]);

      const { result } = renderHook(() => useDJAccount(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      // Create a mock form event
      const formData = new FormData();
      formData.append("realName", "New Name");
      formData.append("djName", "Cool DJ");

      const mockForm = {
        currentTarget: {
          [Symbol.iterator]: function* () {
            yield ["realName", "New Name"];
            yield ["djName", "Cool DJ"];
          },
        },
      };

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          entries: () => formData.entries(),
        },
      } as unknown as React.FormEvent<HTMLFormElement>;

      // Mock FormData on the event target
      Object.defineProperty(mockEvent, "currentTarget", {
        value: document.createElement("form"),
      });

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("should not update if info is null", async () => {
      const { useRegistry } = await import("./authenticationHooks");
      vi.mocked(useRegistry).mockReturnValue({
        info: null,
        loading: false,
      } as any);

      const { authClient } = await import("@/lib/features/authentication/client");
      const store = createTestStore();

      const { result } = renderHook(() => useDJAccount(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: document.createElement("form"),
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      expect(authClient.updateUser).not.toHaveBeenCalled();
    });

    it("should reset modifications when not updating", async () => {
      const store = createTestStore(["realName"]);
      const dispatchSpy = vi.spyOn(store, "dispatch");

      renderHook(() => useDJAccount(), {
        wrapper: ({ children }) => Wrapper({ children, store }),
      });

      // Should dispatch resetModifications when not updating
      expect(dispatchSpy).toHaveBeenCalled();
    });
  });
});
