import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { useAccountListResults } from "./adminHooks";
import { adminSlice } from "@/lib/features/admin/frontend";
import React from "react";

// Mock auth client
const mockListUsers = vi.fn();
const mockGetFullOrganization = vi.fn();
const mockListMembers = vi.fn();

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: {
      listUsers: () => mockListUsers(),
    },
    organization: {
      getFullOrganization: () => mockGetFullOrganization(),
      listMembers: () => mockListMembers(),
    },
  },
}));

// Mock conversions
vi.mock("@/lib/features/admin/conversions-better-auth", () => ({
  convertBetterAuthToAccountResult: vi.fn((user) => ({
    id: user.id,
    userName: user.email || "",
    realName: user.realName || "",
    djName: user.djName || "",
    authorization: 0,
  })),
}));

function createTestStore(preloadedState?: any) {
  return configureStore({
    reducer: {
      admin: adminSlice.reducer,
    },
    preloadedState,
  });
}

function createWrapper(store: ReturnType<typeof createTestStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  };
}

describe("adminHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_ORGANIZATION;
  });

  describe("useAccountListResults", () => {
    it("should return loading state initially", () => {
      mockListUsers.mockReturnValue(new Promise(() => {})); // Never resolves

      const store = createTestStore();
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toEqual([]);
    });

    it("should return accounts when fetch succeeds", async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            { id: "1", email: "user1@test.com", realName: "User One", djName: "DJ One" },
            { id: "2", email: "user2@test.com", realName: "User Two", djName: "DJ Two" },
          ],
        },
        error: null,
      });
      mockGetFullOrganization.mockResolvedValue({ data: null });

      const store = createTestStore();
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.isError).toBe(false);
    });

    it("should return error when fetch fails", async () => {
      mockListUsers.mockResolvedValue({
        data: null,
        error: { message: "Failed to fetch users" },
      });

      const store = createTestStore();
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe("Failed to fetch users");
    });

    it("should handle network error", async () => {
      mockListUsers.mockRejectedValue(new Error("Network error"));

      const store = createTestStore();
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe("Network error");
    });

    it("should filter accounts by search string", async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            { id: "1", email: "user1@test.com", realName: "John Doe", djName: "DJ John" },
            { id: "2", email: "user2@test.com", realName: "Jane Smith", djName: "DJ Jane" },
          ],
        },
        error: null,
      });
      mockGetFullOrganization.mockResolvedValue({ data: null });

      const store = createTestStore({
        admin: {
          ...adminSlice.getInitialState(),
          searchString: "john",
        },
      });
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].realName).toBe("John Doe");
    });

    it("should filter by username", async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            { id: "1", email: "john@test.com", realName: "User One", djName: "DJ One" },
            { id: "2", email: "jane@test.com", realName: "User Two", djName: "DJ Two" },
          ],
        },
        error: null,
      });
      mockGetFullOrganization.mockResolvedValue({ data: null });

      const store = createTestStore({
        admin: {
          ...adminSlice.getInitialState(),
          searchString: "john@",
        },
      });
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].userName).toBe("john@test.com");
    });

    it("should filter by DJ name", async () => {
      mockListUsers.mockResolvedValue({
        data: {
          users: [
            { id: "1", email: "user1@test.com", realName: "User One", djName: "DJ Cool" },
            { id: "2", email: "user2@test.com", realName: "User Two", djName: "DJ Rad" },
          ],
        },
        error: null,
      });
      mockGetFullOrganization.mockResolvedValue({ data: null });

      const store = createTestStore({
        admin: {
          ...adminSlice.getInitialState(),
          searchString: "Cool",
        },
      });
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].djName).toBe("DJ Cool");
    });

    it("should fetch organization members when organization is set", async () => {
      process.env.NEXT_PUBLIC_APP_ORGANIZATION = "test-org";

      mockListUsers.mockResolvedValue({
        data: {
          users: [
            { id: "1", email: "user1@test.com", realName: "User One", djName: "DJ One" },
          ],
        },
        error: null,
      });
      mockGetFullOrganization.mockResolvedValue({
        data: { id: "org-123" },
      });
      mockListMembers.mockResolvedValue({
        data: {
          members: [{ userId: "1", role: "admin" }],
        },
        error: null,
      });

      const store = createTestStore();
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockListMembers).toHaveBeenCalled();
    });

    it("should provide refetch function", async () => {
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });
      mockGetFullOrganization.mockResolvedValue({ data: null });

      const store = createTestStore();
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe("function");

      // Verify refetch can be called
      await act(async () => {
        await result.current.refetch();
      });

      expect(mockListUsers).toHaveBeenCalledTimes(2);
    });

    it("should handle empty users array", async () => {
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });
      mockGetFullOrganization.mockResolvedValue({ data: null });

      const store = createTestStore();
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.isError).toBe(false);
    });

    it("should handle missing users data", async () => {
      mockListUsers.mockResolvedValue({
        data: {},
        error: null,
      });
      mockGetFullOrganization.mockResolvedValue({ data: null });

      const store = createTestStore();
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(store),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
    });
  });
});
