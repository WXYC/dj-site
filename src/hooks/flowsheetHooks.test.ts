import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import type { AppStore } from "@/lib/store";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import React from "react";

// Mock all the API hooks - use importOriginal to preserve API exports needed by store
vi.mock("@/lib/features/flowsheet/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/flowsheet/api")>();
  return {
    ...actual,
    useAddToFlowsheetMutation: vi.fn(() => [
      vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
      { isLoading: false },
    ]),
    useGetEntriesQuery: vi.fn(() => ({
      data: [],
      isLoading: false,
      isSuccess: true,
      isError: false,
    })),
    useJoinShowMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
    useLeaveShowMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
    useRemoveFromFlowsheetMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
    useSwitchEntriesMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
    useUpdateFlowsheetMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
    useWhoIsLiveQuery: vi.fn(() => ({
      data: { djs: [], onAir: "" },
      isLoading: false,
      isSuccess: true,
      isError: false,
    })),
  };
});

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

vi.mock("@/lib/features/bin/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/bin/api")>();
  return {
    ...actual,
    useGetBinQuery: vi.fn(() => ({
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
    info: { id: "test-user-id", djName: "Test DJ" },
  })),
}));

// Import after mocks are set up
import {
  useShowControl,
  useFlowsheetSearch,
  useQueue,
  useFlowsheet,
  useFlowsheetSubmit,
} from "./flowsheetHooks";

describe("flowsheetHooks", () => {
  let store: AppStore;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  }

  beforeEach(() => {
    store = makeStore();
    vi.clearAllMocks();
  });

  describe("useShowControl", () => {
    it("should return initial show control state", () => {
      const { result } = renderHook(() => useShowControl(), { wrapper });

      expect(result.current.live).toBe(false);
      expect(result.current.autoplay).toBe(false);
      expect(result.current.currentShow).toBe(-1);
      expect(typeof result.current.goLive).toBe("function");
      expect(typeof result.current.leave).toBe("function");
      expect(typeof result.current.setAutoPlay).toBe("function");
    });

    it("should update autoplay state", () => {
      const { result } = renderHook(() => useShowControl(), { wrapper });

      expect(result.current.autoplay).toBe(false);

      act(() => {
        result.current.setAutoPlay(true);
      });

      expect(result.current.autoplay).toBe(true);
      expect(flowsheetSlice.selectors.getAutoplay(store.getState())).toBe(true);

      act(() => {
        result.current.setAutoPlay(false);
      });

      expect(result.current.autoplay).toBe(false);
    });
  });

  describe("useFlowsheetSearch", () => {
    it("should return initial search state", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), { wrapper });

      expect(result.current.searchOpen).toBe(false);
      expect(result.current.searchQuery).toEqual({
        song: "",
        artist: "",
        album: "",
        label: "",
        request: false,
      });
      expect(typeof result.current.setSearchOpen).toBe("function");
      expect(typeof result.current.resetSearch).toBe("function");
      expect(typeof result.current.setSearchProperty).toBe("function");
    });

    it("should toggle search panel open state", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), { wrapper });

      expect(result.current.searchOpen).toBe(false);

      act(() => {
        result.current.setSearchOpen(true);
      });

      expect(result.current.searchOpen).toBe(true);

      act(() => {
        result.current.setSearchOpen(false);
      });

      expect(result.current.searchOpen).toBe(false);
    });

    it("should update search properties", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), { wrapper });

      act(() => {
        result.current.setSearchProperty("artist", "Test Artist");
      });

      expect(result.current.searchQuery.artist).toBe("Test Artist");

      act(() => {
        result.current.setSearchProperty("album", "Test Album");
      });

      expect(result.current.searchQuery.album).toBe("Test Album");

      act(() => {
        result.current.setSearchProperty("song", "Test Song");
      });

      expect(result.current.searchQuery.song).toBe("Test Song");

      act(() => {
        result.current.setSearchProperty("label", "Test Label");
      });

      expect(result.current.searchQuery.label).toBe("Test Label");
    });

    it("should reset search to defaults", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), { wrapper });

      // Set some values
      act(() => {
        result.current.setSearchOpen(true);
        result.current.setSearchProperty("artist", "Test Artist");
        result.current.setSearchProperty("album", "Test Album");
      });

      expect(result.current.searchOpen).toBe(true);
      expect(result.current.searchQuery.artist).toBe("Test Artist");

      // Reset
      act(() => {
        result.current.resetSearch();
      });

      expect(result.current.searchOpen).toBe(false);
      expect(result.current.searchQuery).toEqual({
        song: "",
        artist: "",
        album: "",
        label: "",
        request: false,
      });
    });
  });

  describe("useQueue", () => {
    it("should return initial queue state", () => {
      const { result } = renderHook(() => useQueue(), { wrapper });

      expect(result.current.queue).toEqual([]);
      expect(typeof result.current.addToQueue).toBe("function");
      expect(typeof result.current.removeFromQueue).toBe("function");
      // Note: clearQueue, updateQueueEntry, reorderQueue are not exposed from useQueue hook
    });

    it("should not add items when not live", () => {
      // When live is false, addToQueue does nothing
      const { result } = renderHook(() => useQueue(), { wrapper });

      act(() => {
        result.current.addToQueue({
          song: "Test Song",
          artist: "Test Artist",
          album: "Test Album",
          label: "Test Label",
          request: false,
        });
      });

      // Queue should still be empty since we're not live
      expect(result.current.queue).toEqual([]);
    });

    it("should return loading state", () => {
      const { result } = renderHook(() => useQueue(), { wrapper });

      expect(typeof result.current.loading).toBe("boolean");
    });
  });

  describe("useFlowsheet", () => {
    it("should return initial flowsheet state", () => {
      const { result } = renderHook(() => useFlowsheet(), { wrapper });

      expect(result.current.entries.current).toEqual([]);
      expect(result.current.entries.previous).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(typeof result.current.addToFlowsheet).toBe("function");
      expect(typeof result.current.removeFromFlowsheet).toBe("function");
      expect(typeof result.current.updateFlowsheet).toBe("function");
      expect(typeof result.current.removeFromQueue).toBe("function");
    });

    it("should have setCurrentShowEntries function", () => {
      const { result } = renderHook(() => useFlowsheet(), { wrapper });

      expect(typeof result.current.entries.setCurrentShowEntries).toBe("function");
    });

    it("should have switchEntries function", () => {
      const { result } = renderHook(() => useFlowsheet(), { wrapper });

      expect(typeof result.current.entries.switchEntries).toBe("function");
    });

    it("should remove from queue", () => {
      const { result } = renderHook(() => useFlowsheet(), { wrapper });

      // Should not throw when removing from queue
      act(() => {
        result.current.removeFromQueue(1);
      });

      // Verify queue state in store
      expect(store.getState().flowsheet.queue).toEqual([]);
    });
  });

  describe("useFlowsheetSubmit", () => {
    it("should return initial submit state", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

      expect(result.current.ctrlKeyPressed).toBe(false);
      expect(typeof result.current.handleSubmit).toBe("function");
      expect(result.current.binResults).toEqual([]);
      expect(result.current.catalogResults).toEqual([]);
      expect(result.current.rotationResults).toEqual([]);
    });

    it("should detect control key press", async () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

      expect(result.current.ctrlKeyPressed).toBe(false);

      await act(async () => {
        // The hook listens on document, not window
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
      });

      expect(result.current.ctrlKeyPressed).toBe(true);

      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keyup", { key: "Control" }));
      });

      expect(result.current.ctrlKeyPressed).toBe(false);
    });

    it("should have selectedResultData with default values", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

      expect(result.current.selectedResultData).toEqual({
        song: "",
        artist: "",
        album: "",
        label: "",
        request: false,
      });
    });

    it("should return selectedEntry as null when no result selected", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

      expect(result.current.selectedEntry).toBeNull();
    });

    it("should call handleSubmit without errors", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

      // handleSubmit should work without throwing
      act(() => {
        result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      // Search should be reset after submit
      expect(store.getState().flowsheet.search.open).toBe(false);
    });
  });
});
