import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import type { AppStore } from "@/lib/store";
import { useCatalogSearch } from "./catalogHooks";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import React from "react";

// Mock RTK Query hooks - use importOriginal to preserve API exports needed by store
vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useSearchCatalogQuery: vi.fn(() => ({
      data: [],
      isLoading: false,
      isSuccess: true,
      isError: false,
    })),
  };
});

vi.mock("@/lib/features/rotation/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/rotation/api")>();
  return {
    ...actual,
    useGetRotationQuery: vi.fn(() => ({
      data: [],
      isLoading: false,
      isSuccess: true,
      isError: false,
    })),
  };
});

vi.mock("./authenticationHooks", () => ({
  useAuthentication: vi.fn(() => ({
    authenticating: false,
    authenticated: true,
  })),
  useRegistry: vi.fn(() => ({
    loading: false,
    info: { id: "test-user-id" },
  })),
}));

describe("catalogHooks", () => {
  let store: AppStore;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  }

  beforeEach(() => {
    store = makeStore();
    vi.clearAllMocks();
  });

  describe("useCatalogSearch", () => {
    it("should return initial search state", () => {
      const { result } = renderHook(() => useCatalogSearch(), { wrapper });

      expect(result.current.searchString).toBe("");
      expect(result.current.orderBy).toBe("title");
      expect(result.current.orderDirection).toBe("asc");
      expect(result.current.n).toBe(10);
      expect(result.current.selected).toEqual([]);
    });

    it("should update search string", async () => {
      const { result } = renderHook(() => useCatalogSearch(), { wrapper });

      act(() => {
        result.current.setSearchString("test query");
      });

      expect(result.current.searchString).toBe("test query");
      expect(catalogSlice.selectors.getSearchQuery(store.getState())).toBe(
        "test query"
      );
    });

    it("should update search in (Albums/Artists/All)", async () => {
      const { result } = renderHook(() => useCatalogSearch(), { wrapper });

      act(() => {
        result.current.setSearchIn("Albums");
      });

      expect(catalogSlice.selectors.getSearchIn(store.getState())).toBe(
        "Albums"
      );

      act(() => {
        result.current.setSearchIn("Artists");
      });

      expect(catalogSlice.selectors.getSearchIn(store.getState())).toBe(
        "Artists"
      );
    });

    it("should update search genre", async () => {
      const { result } = renderHook(() => useCatalogSearch(), { wrapper });

      act(() => {
        result.current.setSearchGenre("Rock");
      });

      expect(catalogSlice.selectors.getSearchGenre(store.getState())).toBe(
        "Rock"
      );

      act(() => {
        result.current.setSearchGenre("All");
      });

      expect(catalogSlice.selectors.getSearchGenre(store.getState())).toBe(
        "All"
      );
    });

    it("should handle selection operations", async () => {
      const { result } = renderHook(() => useCatalogSearch(), { wrapper });

      // Add selection
      act(() => {
        result.current.addSelection(1);
      });
      expect(result.current.selected).toEqual([1]);

      // Add another
      act(() => {
        result.current.addSelection(2);
      });
      expect(result.current.selected).toEqual([1, 2]);

      // Remove selection
      act(() => {
        result.current.removeSelection(1);
      });
      expect(result.current.selected).toEqual([2]);

      // Set selection
      act(() => {
        result.current.setSelection([5, 6, 7]);
      });
      expect(result.current.selected).toEqual([5, 6, 7]);

      // Clear selection
      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selected).toEqual([]);
    });

    it("should handle sort request - toggle direction when same column", async () => {
      const { result } = renderHook(() => useCatalogSearch(), { wrapper });

      // Initial state
      expect(result.current.orderBy).toBe("title");
      expect(result.current.orderDirection).toBe("asc");

      // Click on title again - should toggle direction
      act(() => {
        result.current.handleRequestSort("title");
      });

      expect(result.current.orderBy).toBe("title");
      expect(result.current.orderDirection).toBe("desc");

      // Click on title again - should toggle back
      act(() => {
        result.current.handleRequestSort("title");
      });

      expect(result.current.orderBy).toBe("title");
      expect(result.current.orderDirection).toBe("asc");
    });

    it("should handle sort request - change column keeps direction", async () => {
      const { result } = renderHook(() => useCatalogSearch(), { wrapper });

      // Initial state
      expect(result.current.orderBy).toBe("title");
      expect(result.current.orderDirection).toBe("asc");

      // Click on artist - should change column, keep direction
      act(() => {
        result.current.handleRequestSort("artist");
      });

      expect(result.current.orderBy).toBe("artist");
      expect(result.current.orderDirection).toBe("asc");
    });

    it("should expose dispatch and catalogSlice", () => {
      const { result } = renderHook(() => useCatalogSearch(), { wrapper });

      expect(result.current.dispatch).toBeDefined();
      expect(typeof result.current.dispatch).toBe("function");
      expect(result.current.catalogSlice).toBeDefined();
    });
  });
});
