import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDJAccount } from "./djHooks";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { createHookWrapper } from "@/lib/test-utils";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import React from "react";

// Use vi.hoisted for variables used in vi.mock
const {
  mockRefresh,
  mockToastError,
  mockToastSuccess,
  mockUpdateUser,
  mockGetSession,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockGetSession: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

// Mock authentication hooks - create a variable that can be changed per test
let mockRegistryInfo: { id: string; real_name: string; dj_name: string } | null = {
  id: "test-user-1",
  real_name: "Test User",
  dj_name: "Test DJ",
};
let mockRegistryLoading = false;

vi.mock("./authenticationHooks", () => ({
  useRegistry: () => ({
    loading: mockRegistryLoading,
    info: mockRegistryInfo,
  }),
}));

// Mock auth client
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    updateUser: (...args: any[]) => mockUpdateUser(...args),
    getSession: () => mockGetSession(),
  },
}));

const createWrapper = () =>
  createHookWrapper({ authentication: authenticationSlice });

// Helper to create a wrapper that also returns the store for dispatching actions
function createWrapperWithStore() {
  const store = configureStore({
    reducer: {
      authentication: authenticationSlice.reducer,
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { Wrapper, store };
}

// Helper to create mock form with actual inputs that FormData can read
function createMockForm(fields: Record<string, string>): HTMLFormElement {
  const form = document.createElement("form");
  document.body.appendChild(form);

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  return form;
}

function cleanupForm(form: HTMLFormElement): void {
  if (form.parentNode) {
    form.parentNode.removeChild(form);
  }
}

describe("djHooks", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock values
    mockRegistryInfo = {
      id: "test-user-1",
      real_name: "Test User",
      dj_name: "Test DJ",
    };
    mockRegistryLoading = false;
    mockUpdateUser.mockResolvedValue({});
    mockGetSession.mockResolvedValue({
      data: { user: { id: "test-user-1" } },
    });
  });

  describe("useDJAccount", () => {
    it("should return user info", () => {
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      expect(result.current.info).toEqual(mockRegistryInfo);
    });

    it("should return loading state", () => {
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.loading).toBe("boolean");
    });

    it("should return handleSaveData function", () => {
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.handleSaveData).toBe("function");
    });

    it("should call preventDefault when handleSaveData is called", async () => {
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({});

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      cleanupForm(mockForm);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("should handle form submission without errors", async () => {
      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      cleanupForm(mockForm);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it("should not call updateUser when no modifications exist", async () => {
      // Use the default wrapper - no modifications are set after reset
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({});

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      cleanupForm(mockForm);
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("should return early when info is null", async () => {
      mockRegistryInfo = null;

      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      cleanupForm(mockForm);
      // Should return early and not call updateUser
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("should return early when info is undefined", async () => {
      mockRegistryInfo = undefined as any;

      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      cleanupForm(mockForm);
      // Should return early and not call updateUser
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("should call updateUser with realName when modified", async () => {
      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      cleanupForm(mockForm);
      expect(mockUpdateUser).toHaveBeenCalledWith({ realName: "New Name" });
      expect(mockToastSuccess).toHaveBeenCalledWith("User settings saved.");
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("should call updateUser with djName when modified", async () => {
      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "djName", value: true }));
      });

      const mockForm = createMockForm({ djName: "DJ New" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      cleanupForm(mockForm);
      expect(mockUpdateUser).toHaveBeenCalledWith({ djName: "DJ New" });
    });

    it("should call updateUser with email when modified", async () => {
      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "email", value: true }));
      });

      const mockForm = createMockForm({ email: "new@email.com" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      cleanupForm(mockForm);
      expect(mockUpdateUser).toHaveBeenCalledWith({ email: "new@email.com" });
    });

    it("should call updateUser with all fields when all modified", async () => {
      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify actions after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
        store.dispatch(authenticationSlice.actions.modify({ key: "djName", value: true }));
        store.dispatch(authenticationSlice.actions.modify({ key: "email", value: true }));
      });

      const mockForm = createMockForm({
        realName: "New Name",
        djName: "DJ New",
        email: "new@email.com",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      cleanupForm(mockForm);

      expect(mockUpdateUser).toHaveBeenCalledWith({
        realName: "New Name",
        djName: "DJ New",
        email: "new@email.com",
      });
    });

    it("should skip empty values even if modification flag is set", async () => {
      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify actions after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
        store.dispatch(authenticationSlice.actions.modify({ key: "djName", value: true }));
      });

      // Only realName has a value, djName is empty string
      const mockForm = createMockForm({
        realName: "New Name",
        djName: "",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      expect(mockUpdateUser).toHaveBeenCalledWith({ realName: "New Name" });
    });

    it("should not call updateUser if updateData is empty after filtering", async () => {
      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      // realName is modified flag is set, but value is empty
      const mockForm = createMockForm({ realName: "" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("should handle updateUser returning error without message", async () => {
      mockUpdateUser.mockResolvedValue({
        error: {},
      });

      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      expect(mockToastError).toHaveBeenCalledWith("Failed to update user");
    });

    it("should support djName modification", async () => {
      // This test verifies that the djName modification path exists
      // The actual authClient.updateUser call depends on the modifications selector
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({ djName: "New DJ Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      // Should finish without errors
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it("should support email modification", async () => {
      // This test verifies that the email modification path exists
      // The actual authClient.updateUser call depends on the modifications selector
      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      const mockForm = createMockForm({ email: "new@email.com" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      // Should finish without errors
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it("should handle updateUser error and finish loading", async () => {
      mockUpdateUser.mockResolvedValue({
        error: { message: "Update failed" },
      });

      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      // Should finish loading after error
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(mockToastError).toHaveBeenCalledWith("Update failed");
    });

    it("should handle session error and finish loading", async () => {
      mockGetSession.mockResolvedValue({
        data: { user: null },
      });

      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      // Should finish loading after session error
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(mockToastError).toHaveBeenCalledWith("User not authenticated");
    });

    it("should handle thrown exceptions and finish loading", async () => {
      mockGetSession.mockRejectedValue(new Error("Network error"));

      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      // Should finish loading after thrown exception
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(mockToastError).toHaveBeenCalledWith("Network error");
    });

    it("should handle non-Error exceptions and finish loading", async () => {
      mockGetSession.mockRejectedValue("String error");

      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      // Should finish loading after non-Error exception
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      // Non-Error exceptions use the fallback message
      expect(mockToastError).toHaveBeenCalledWith("Failed to update user settings");
    });

    it("should show loading true when isUpdating is true", async () => {
      let resolveGetSession: () => void;
      mockGetSession.mockReturnValue(
        new Promise((resolve) => {
          resolveGetSession = () => resolve({ data: { user: { id: "test-user-1" } } });
        })
      );

      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      act(() => {
        result.current.handleSaveData(mockEvent);
      });

      // Loading should be true while updating
      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveGetSession!();
      });
    });

    it("should show loading true when registry is loading", async () => {
      mockRegistryLoading = true;

      const { result } = renderHook(() => useDJAccount(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
    });

    it("should not show toast for empty error message", async () => {
      mockGetSession.mockRejectedValue(new Error("   "));

      const { Wrapper, store } = createWrapperWithStore();

      const { result } = renderHook(() => useDJAccount(), { wrapper: Wrapper });

      // Dispatch modify action after initial mount (which resets modifications)
      act(() => {
        store.dispatch(authenticationSlice.actions.modify({ key: "realName", value: true }));
      });

      const mockForm = createMockForm({ realName: "New Name" });

      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: mockForm,
      } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSaveData(mockEvent);
      });

      // Toast should not be called for whitespace-only error messages
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });
});
