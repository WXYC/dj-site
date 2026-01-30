import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { useBin, useDeleteFromBin, useAddToBin, useBinResults } from "./binHooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";

// Mock authentication hooks
vi.mock("./authenticationHooks", () => ({
  useRegistry: vi.fn(() => ({
    loading: false,
    info: { id: 1, djName: "Test DJ" },
  })),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock bin API hooks
const mockDeleteFromBin = vi.fn();
const mockAddToBin = vi.fn();

vi.mock("@/lib/features/bin/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/bin/api")>();
  return {
    ...actual,
    useGetBinQuery: vi.fn(() => ({
      data: [
        { id: 1, title: "Test Album", artist: { name: "Test Artist" }, label: "Test Label" },
        { id: 2, title: "Another Album", artist: { name: "Another Artist" }, label: "Another Label" },
      ],
      isLoading: false,
      isSuccess: true,
      isError: false,
    })),
    useDeleteFromBinMutation: vi.fn(() => [
      mockDeleteFromBin,
      { isLoading: false, isError: false },
    ]),
    useAddToBinMutation: vi.fn(() => [
      mockAddToBin,
      { isLoading: false, isError: false },
    ]),
  };
});

function createTestStore() {
  return configureStore({
    reducer: {
      flowsheet: flowsheetSlice.reducer,
    },
  });
}

function createWrapper() {
  const store = createTestStore();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("binHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useBin", () => {
    it("should return bin data when loaded", () => {
      const { result } = renderHook(() => useBin(), { wrapper: createWrapper() });

      expect(result.current.bin).toHaveLength(2);
      expect(result.current.loading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });

    it("should return isError status", () => {
      const { result } = renderHook(() => useBin(), { wrapper: createWrapper() });

      expect(result.current.isError).toBe(false);
    });
  });

  describe("useDeleteFromBin", () => {
    it("should return deleteFromBin function", () => {
      const { result } = renderHook(() => useDeleteFromBin(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.deleteFromBin).toBe("function");
    });

    it("should call mutation when deleteFromBin is called", () => {
      const { result } = renderHook(() => useDeleteFromBin(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.deleteFromBin(1);
      });

      expect(mockDeleteFromBin).toHaveBeenCalledWith({ dj_id: 1, album_id: 1 });
    });

    it("should return loading state", () => {
      const { result } = renderHook(() => useDeleteFromBin(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe("useAddToBin", () => {
    it("should return addToBin function", () => {
      const { result } = renderHook(() => useAddToBin(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.addToBin).toBe("function");
    });

    it("should call mutation when addToBin is called", () => {
      const { result } = renderHook(() => useAddToBin(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addToBin(2);
      });

      expect(mockAddToBin).toHaveBeenCalledWith({ dj_id: 1, album_id: 2 });
    });

    it("should return loading state", () => {
      const { result } = renderHook(() => useAddToBin(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe("useBinResults", () => {
    it("should return empty results when search query is too short", () => {
      const { result } = renderHook(() => useBinResults(), {
        wrapper: createWrapper(),
      });

      // Default search query is empty, so should return empty results
      expect(result.current.searchResults).toEqual([]);
    });

    it("should filter bin by search terms", () => {
      const initialState = flowsheetSlice.getInitialState();
      const store = configureStore({
        reducer: {
          flowsheet: flowsheetSlice.reducer,
        },
        preloadedState: {
          flowsheet: {
            ...initialState,
            search: {
              ...initialState.search,
              query: {
                ...initialState.search.query,
                album: "Test Album",
                artist: "",
                label: "",
              },
            },
          },
        },
      });

      function wrapper({ children }: { children: React.ReactNode }) {
        return <Provider store={store}>{children}</Provider>;
      }

      const { result } = renderHook(() => useBinResults(), { wrapper });

      expect(result.current.searchResults).toHaveLength(1);
      expect(result.current.searchResults[0].title).toBe("Test Album");
    });

    it("should search by artist name", () => {
      const initialState = flowsheetSlice.getInitialState();
      const store = configureStore({
        reducer: {
          flowsheet: flowsheetSlice.reducer,
        },
        preloadedState: {
          flowsheet: {
            ...initialState,
            search: {
              ...initialState.search,
              query: {
                ...initialState.search.query,
                album: "",
                artist: "Another Artist",
                label: "",
              },
            },
          },
        },
      });

      function wrapper({ children }: { children: React.ReactNode }) {
        return <Provider store={store}>{children}</Provider>;
      }

      const { result } = renderHook(() => useBinResults(), { wrapper });

      expect(result.current.searchResults).toHaveLength(1);
      expect(result.current.searchResults[0].artist?.name).toBe("Another Artist");
    });
  });
});
