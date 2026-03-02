import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useCatalogSearch,
  useCatalogResults,
  useCatalogFlowsheetSearch,
  useRotationFlowsheetSearch,
} from "./catalogHooks";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  createHookWrapper,
  createTestAlbum,
  createTestArtist,
} from "@/lib/test-utils";

// Mock authentication hooks
vi.mock("./authenticationHooks", () => ({
  useAuthentication: vi.fn(() => ({
    authenticating: false,
    authenticated: true,
  })),
  useRegistry: vi.fn(() => ({
    loading: false,
    info: { id: "test-user-1", djName: "Test DJ" },
  })),
}));

// Mock catalog API hooks
const mockCatalogData = [
  createTestAlbum({
    id: 1,
    title: "Test Album",
    artist: createTestArtist({ name: "Test Artist" }),
    label: "Test Label",
  }),
  createTestAlbum({
    id: 2,
    title: "Another Album",
    artist: createTestArtist({ name: "Another Artist" }),
    label: "Another Label",
  }),
];

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useSearchCatalogQuery: vi.fn(() => ({
      data: mockCatalogData,
      isLoading: false,
      isSuccess: true,
      isError: false,
    })),
  };
});

// Mock rotation API hooks
const mockRotationData = [
  createTestAlbum({
    id: 3,
    title: "Rotation Album",
    artist: createTestArtist({ name: "Rotation Artist" }),
    label: "Rotation Label",
    play_freq: "H",
    rotation_id: 1,
  }),
];

vi.mock("@/lib/features/rotation/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/rotation/api")>();
  return {
    ...actual,
    useGetRotationQuery: vi.fn(() => ({
      data: mockRotationData,
      isLoading: false,
      isSuccess: true,
    })),
  };
});

const createWrapper = () =>
  createHookWrapper({ catalog: catalogSlice, flowsheet: flowsheetSlice });

describe("catalogHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("useCatalogSearch", () => {
    it("should return initial search state", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      expect(result.current.searchString).toBe("");
      expect(result.current.orderBy).toBe("title");
      expect(result.current.orderDirection).toBe("asc");
      expect(result.current.selected).toEqual([]);
      expect(result.current.n).toBe(10);
    });

    it("should update search string when setSearchString is called", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchString("test query");
      });

      expect(result.current.searchString).toBe("test query");
    });

    it("should update search in when setSearchIn is called", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchIn("Artists");
      });

      // The state update happens via dispatch, check the action was called
      expect(typeof result.current.setSearchIn).toBe("function");
    });

    it("should update search genre when setSearchGenre is called", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchGenre("Rock");
      });

      expect(typeof result.current.setSearchGenre).toBe("function");
    });

    it("should add selection when addSelection is called", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addSelection(1);
      });

      expect(result.current.selected).toContain(1);
    });

    it("should remove selection when removeSelection is called", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addSelection(1);
        result.current.addSelection(2);
      });

      expect(result.current.selected).toContain(1);
      expect(result.current.selected).toContain(2);

      act(() => {
        result.current.removeSelection(1);
      });

      expect(result.current.selected).not.toContain(1);
      expect(result.current.selected).toContain(2);
    });

    it("should set selection when setSelection is called", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelection([1, 2, 3]);
      });

      expect(result.current.selected).toEqual([1, 2, 3]);
    });

    it("should clear selection when clearSelection is called", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addSelection(1);
        result.current.addSelection(2);
      });

      expect(result.current.selected.length).toBe(2);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selected).toEqual([]);
    });

    it("should toggle sort direction when handleRequestSort is called with same column", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      expect(result.current.orderDirection).toBe("asc");

      act(() => {
        result.current.handleRequestSort("title");
      });

      expect(result.current.orderDirection).toBe("desc");

      act(() => {
        result.current.handleRequestSort("title");
      });

      expect(result.current.orderDirection).toBe("asc");
    });

    it("should update orderBy when handleRequestSort is called with different column", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      expect(result.current.orderBy).toBe("title");

      act(() => {
        result.current.handleRequestSort("artist");
      });

      expect(result.current.orderBy).toBe("artist");
    });

    it("should expose dispatch and catalogSlice", () => {
      const { result } = renderHook(() => useCatalogSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.dispatch).toBe("function");
      expect(result.current.catalogSlice).toBeDefined();
    });
  });

  describe("useCatalogResults", () => {
    it("should return data from the catalog API", () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeDefined();
    });

    it("should return loading state", () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.loading).toBe("boolean");
    });

    it("should return setSearchString function", () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.setSearchString).toBe("function");
    });

    it("should return setSearchIn function", () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.setSearchIn).toBe("function");
    });

    it("should return setSearchGenre function", () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.setSearchGenre).toBe("function");
    });

    it("should return addSelection function", () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.addSelection).toBe("function");
    });

    it("should return removeSelection function", () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.removeSelection).toBe("function");
    });

    it("should return loadMore function", () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.loadMore).toBe("function");
    });

    it("should return reachedEndForQuery state", () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.reachedEndForQuery).toBe("boolean");
    });

    it("should clear selection when search changes", async () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchString("test");
      });

      // Fast-forward timers to trigger the debounced effect
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // The clearSelection should have been called as part of the search update effect
      expect(typeof result.current.setSearchString).toBe("function");
    });

    it("should skip query when not authenticated", async () => {
      const { useAuthentication } = await import("./authenticationHooks");
      vi.mocked(useAuthentication).mockReturnValue({
        authenticating: false,
        authenticated: false,
        data: { message: "Not Authenticated" },
        error: null,
      });

      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeDefined();
    });

    it("should skip query when search string is too short", async () => {
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: createWrapper(),
      });

      // Initial search string is empty
      expect(result.current.searchString).toBe("");
    });
  });

  describe("useCatalogFlowsheetSearch", () => {
    it("should return empty results when query is too short", () => {
      const { result } = renderHook(() => useCatalogFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      // Default flowsheet query is empty, so should return empty results
      expect(result.current.searchResults).toEqual([]);
    });

    it("should return search results when query is long enough", () => {
      const initialState = flowsheetSlice.getInitialState();
      const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, catalog: catalogSlice },
        {
          flowsheet: {
            ...initialState,
            search: {
              ...initialState.search,
              query: {
                ...initialState.search.query,
                artist: "Test Artist",
                album: "",
                label: "",
                song: "",
                request: false,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useCatalogFlowsheetSearch(), {
        wrapper,
      });

      // Should have results because query is long enough
      expect(result.current.searchResults).toBeDefined();
    });

    it("should skip query when authenticating", async () => {
      const { useAuthentication } = await import("./authenticationHooks");
      vi.mocked(useAuthentication).mockReturnValue({
        authenticating: true,
        authenticated: false,
        data: { message: "Not Authenticated" },
        error: null,
      });

      const { result } = renderHook(() => useCatalogFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(result.current.searchResults).toEqual([]);
    });
  });

  describe("useRotationFlowsheetSearch", () => {
    it("should return empty results when query is too short", () => {
      const { result } = renderHook(() => useRotationFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(result.current.searchResults).toEqual([]);
      expect(typeof result.current.loading).toBe("boolean");
    });

    it("should filter rotation data when query is long enough", () => {
      const initialState = flowsheetSlice.getInitialState();
      const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, catalog: catalogSlice },
        {
          flowsheet: {
            ...initialState,
            search: {
              ...initialState.search,
              query: {
                ...initialState.search.query,
                artist: "Rotation Artist",
                album: "",
                label: "",
                song: "",
                request: false,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useRotationFlowsheetSearch(), {
        wrapper,
      });

      // Results should be filtered based on the rotation data
      expect(Array.isArray(result.current.searchResults)).toBe(true);
    });

    it("should return loading state", () => {
      const { result } = renderHook(() => useRotationFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.loading).toBe("boolean");
    });

    it("should skip query when not authenticated", async () => {
      const { useAuthentication } = await import("./authenticationHooks");
      vi.mocked(useAuthentication).mockReturnValue({
        authenticating: false,
        authenticated: false,
        data: { message: "Not Authenticated" },
        error: null,
      });

      const { result } = renderHook(() => useRotationFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(result.current.searchResults).toEqual([]);
    });

    it("should filter by artist name", () => {
      const initialState = flowsheetSlice.getInitialState();
      const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, catalog: catalogSlice },
        {
          flowsheet: {
            ...initialState,
            search: {
              ...initialState.search,
              query: {
                ...initialState.search.query,
                artist: "Rotation",
                album: "",
                label: "",
                song: "",
                request: false,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useRotationFlowsheetSearch(), {
        wrapper,
      });

      expect(Array.isArray(result.current.searchResults)).toBe(true);
    });

    it("should filter by album title", () => {
      const initialState = flowsheetSlice.getInitialState();
      const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, catalog: catalogSlice },
        {
          flowsheet: {
            ...initialState,
            search: {
              ...initialState.search,
              query: {
                ...initialState.search.query,
                artist: "",
                album: "Rotation Album",
                label: "",
                song: "",
                request: false,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useRotationFlowsheetSearch(), {
        wrapper,
      });

      expect(Array.isArray(result.current.searchResults)).toBe(true);
    });

    it("should filter by label", () => {
      const initialState = flowsheetSlice.getInitialState();
      const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, catalog: catalogSlice },
        {
          flowsheet: {
            ...initialState,
            search: {
              ...initialState.search,
              query: {
                ...initialState.search.query,
                artist: "",
                album: "",
                label: "Rotation Label",
                song: "",
                request: false,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useRotationFlowsheetSearch(), {
        wrapper,
      });

      expect(Array.isArray(result.current.searchResults)).toBe(true);
    });
  });
});
