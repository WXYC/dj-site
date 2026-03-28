import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAccountListResults } from "./adminHooks";
import { adminSlice } from "@/lib/features/admin/frontend";
import { createHookWrapperFactory } from "@/lib/test-utils";

// Mock authClient
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: {
      listUsers: vi.fn(() =>
        Promise.resolve({
          data: {
            users: [
              { id: "user-1", name: "Test User", email: "test@example.com", realName: "Real Name", djName: "DJ Test", role: "member" },
              { id: "user-2", name: "Admin User", email: "admin@example.com", realName: "Admin Real", djName: "DJ Admin", role: "admin" },
            ],
          },
          error: null,
        })
      ),
    },
    organization: {
      getFullOrganization: vi.fn(() => Promise.resolve({ data: { id: "org-1" } })),
      listMembers: vi.fn(() =>
        Promise.resolve({
          data: { members: [{ userId: "user-1", role: "member" }, { userId: "user-2", role: "admin" }] },
          error: null,
        })
      ),
    },
  },
}));

// Mock conversions
vi.mock("@/lib/features/admin/conversions-better-auth", () => ({
  convertBetterAuthToAccountResult: vi.fn((user) => ({
    id: user.id,
    userName: user.email || user.name,
    realName: user.realName || "",
    djName: user.djName || "",
    role: user.role,
  })),
}));

const createWrapper = createHookWrapperFactory({ admin: adminSlice });

describe("adminHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useAccountListResults", () => {
    it("should initially be loading", () => {
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it("should return accounts after loading", async () => {
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(2);
    });

    it("should provide refetch function", async () => {
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe("function");
    });

    it("should return isError status", async () => {
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(false);
    });

    it("should filter accounts by search string", async () => {
      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper({ admin: { searchString: "admin" } }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should filter to only admin user
      expect(result.current.data.some((a) => a.userName.includes("admin"))).toBe(
        true
      );
    });

    it("should return error state on fetch failure", async () => {
      // Override mock to return error
      const { authClient } = await import("@/lib/features/authentication/client");
      vi.mocked(authClient.admin.listUsers).mockResolvedValueOnce({
        data: null,
        error: { message: "Failed to fetch" },
      } as any);

      const { result } = renderHook(() => useAccountListResults(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });
  });
});
