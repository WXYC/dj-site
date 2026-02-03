import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBin, useDeleteFromBin, useAddToBin, useBinResults } from "./binHooks";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import React from "react";

// Mock hooks and APIs
vi.mock("./authenticationHooks", () => ({
  useRegistry: vi.fn(() => ({
    loading: false,
    info: { id: 1, username: "testuser" },
  })),
}));

vi.mock("@/lib/features/bin/api", () => ({
  useGetBinQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    isSuccess: true,
    isError: false,
  })),
  useDeleteFromBinMutation: vi.fn(() => [
    vi.fn(),
    { isLoading: false, isError: false },
  ]),
  useAddToBinMutation: vi.fn(() => [
    vi.fn(),
    { isLoading: false, isError: false },
  ]),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Create a mock store for useBinResults
function createTestStore() {
  return configureStore({
    reducer: {
      flowsheet: flowsheetSlice.reducer,
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const store = createTestStore();
  return React.createElement(Provider, { store }, children);
}

describe("binHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useBin", () => {
    it("should return bin data when loaded", async () => {
      const mockBin = [
        { id: 1, title: "Album 1" },
        { id: 2, title: "Album 2" },
      ];

      const { useGetBinQuery } = await import("@/lib/features/bin/api");
      vi.mocked(useGetBinQuery).mockReturnValue({
        data: mockBin,
        isLoading: false,
        isSuccess: true,
        isError: false,
      } as any);

      const { result } = renderHook(() => useBin());

      expect(result.current.bin).toEqual(mockBin);
      expect(result.current.loading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });

    it("should return loading state", async () => {
      const { useGetBinQuery } = await import("@/lib/features/bin/api");
      vi.mocked(useGetBinQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
        isSuccess: false,
        isError: false,
      } as any);

      const { result } = renderHook(() => useBin());

      expect(result.current.loading).toBe(true);
    });

    it("should return error state", async () => {
      const { useGetBinQuery } = await import("@/lib/features/bin/api");
      vi.mocked(useGetBinQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        isSuccess: false,
        isError: true,
      } as any);

      const { result } = renderHook(() => useBin());

      expect(result.current.isError).toBe(true);
    });

    it("should skip query when user info is not available", async () => {
      const { useRegistry } = await import("./authenticationHooks");
      vi.mocked(useRegistry).mockReturnValue({
        loading: true,
        info: null,
      } as any);

      const { useGetBinQuery } = await import("@/lib/features/bin/api");

      renderHook(() => useBin());

      // Query should be called with skip: true
      expect(useGetBinQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true })
      );
    });
  });

  describe("useDeleteFromBin", () => {
    it("should return deleteFromBin function", () => {
      const { result } = renderHook(() => useDeleteFromBin());

      expect(result.current.deleteFromBin).toBeDefined();
      expect(typeof result.current.deleteFromBin).toBe("function");
    });

    it("should return loading property", () => {
      const { result } = renderHook(() => useDeleteFromBin());

      expect(result.current).toHaveProperty("loading");
    });
  });

  describe("useAddToBin", () => {
    it("should return addToBin function", () => {
      const { result } = renderHook(() => useAddToBin());

      expect(result.current.addToBin).toBeDefined();
      expect(typeof result.current.addToBin).toBe("function");
    });

    it("should return loading property", () => {
      const { result } = renderHook(() => useAddToBin());

      expect(result.current).toHaveProperty("loading");
    });
  });

  describe("useBinResults", () => {
    it("should return empty results when bin is empty", () => {
      const { result } = renderHook(() => useBinResults(), {
        wrapper: Wrapper,
      });

      expect(result.current.searchResults).toEqual([]);
    });

    it("should return empty results when query is too short", async () => {
      const { useGetBinQuery } = await import("@/lib/features/bin/api");
      vi.mocked(useGetBinQuery).mockReturnValue({
        data: [
          { id: 1, title: "Test Album", artist: { name: "Test Artist" } },
        ],
        isLoading: false,
        isSuccess: true,
        isError: false,
      } as any);

      const { result } = renderHook(() => useBinResults(), {
        wrapper: Wrapper,
      });

      // With default empty search query, should return empty
      expect(result.current.searchResults).toEqual([]);
    });
  });
});
