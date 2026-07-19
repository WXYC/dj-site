import type { FormEvent } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useShowControl,
  useFlowsheetSearch,
  useFlowsheet,
  useQueue,
  useFlowsheetSubmit,
} from "@/src/hooks/flowsheetHooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { liveUpdatesSlice } from "@/lib/features/flowsheet/live-updates-slice";
import {
  createHookWrapper,
  createTestFlowsheetEntry,
  createTestAlbum,
  createTestArtist,
} from "@/tests/helpers";

// Mock authentication hooks
const mockUserInfo = {
  id: "test-user-1",
  real_name: "Test User",
  dj_name: "Test DJ",
};

const mockUseRegistry = vi.fn(() => ({
  loading: false,
  info: mockUserInfo as typeof mockUserInfo | null,
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => mockUseRegistry(),
}));

// Mock bin hooks
vi.mock("@/src/hooks/binHooks", () => ({
  useBinResults: vi.fn(() => ({
    searchResults: [],
  })),
}));

// Mock catalog hooks
const mockUseCatalogFlowsheetSearch = vi.fn(() => ({
  searchResults: [] as ReturnType<typeof createTestAlbum>[],
}));
const mockUseRotationFlowsheetSearch = vi.fn(() => ({
  searchResults: [] as ReturnType<typeof createTestAlbum>[],
  loading: false,
}));

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogFlowsheetSearch: () => mockUseCatalogFlowsheetSearch(),
  useRotationFlowsheetSearch: () => mockUseRotationFlowsheetSearch(),
}));

// Mock LML hooks (#563 — useLmlLibrarySearch now wraps lmlApi RTK Query, which
// isn't in the createHookWrapper store these tests use).
vi.mock("@/src/hooks/useLmlLibrarySearch", () => ({
  useLmlLibrarySearch: () => ({ results: [], isLoading: false }),
}));

// Mock flowsheet API hooks
const mockGoLiveFunction = vi.fn();
const mockLeaveFunction = vi.fn();
const mockAddToFlowsheet = vi.fn(() => ({
  unwrap: () => Promise.resolve({ id: 1 }),
}));
const mockRemoveFromFlowsheet = vi.fn();
const mockUpdateFlowsheetEntry = vi.fn();
const mockSwitchBackendEntries = vi.fn(() => Promise.resolve());

const mockFlowsheetData = [
  createTestFlowsheetEntry({ id: 1, show_id: 100, play_order: 1 }),
  createTestFlowsheetEntry({ id: 2, show_id: 100, play_order: 2 }),
];

const mockLiveData = {
  djs: [{ id: "test-user-1", dj_name: "Test DJ" }],
  onAir: "Test DJ",
};

const mockUseWhoIsLiveQuery = vi.fn(() => ({
  data: mockLiveData,
  isLoading: false,
  isSuccess: true,
}));

const mockUseGetEntriesQuery = vi.fn(() => ({
  data: mockFlowsheetData,
  isLoading: false,
  isSuccess: true,
  isError: false,
}));

const mockUseGetInfiniteEntriesInfiniteQuery = vi.fn(() => ({
  data: { pages: [mockFlowsheetData] },
  isLoading: false,
  isSuccess: true,
  isError: false,
  isFetching: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
}));

// Like RTK Query, apply an options.selectFromResult over the base result
// while keeping the hook-level functions (refetch, fetchNextPage) intact.
type QueryHookOptions = {
  selectFromResult?: (r: unknown) => Record<string, unknown>;
};
function withSelectFromResult(
  result: Record<string, unknown>,
  options?: QueryHookOptions
) {
  return options?.selectFromResult
    ? { ...result, ...options.selectFromResult(result) }
    : result;
}

vi.mock("@/lib/features/flowsheet/api", () => ({
  useGetEntriesQuery: () => mockUseGetEntriesQuery(),
  useGetInfiniteEntriesInfiniteQuery: (
    _arg: unknown,
    options?: QueryHookOptions
  ) => withSelectFromResult(mockUseGetInfiniteEntriesInfiniteQuery(), options),
  useWhoIsLiveQuery: (_arg: unknown, options?: QueryHookOptions) =>
    withSelectFromResult(mockUseWhoIsLiveQuery(), options),
  useJoinShowMutation: () => [mockGoLiveFunction, { isLoading: false }],
  useLeaveShowMutation: () => [mockLeaveFunction, { isLoading: false }],
  useAddToFlowsheetMutation: () => [mockAddToFlowsheet, { isLoading: false }],
  useRemoveFromFlowsheetMutation: () => [
    mockRemoveFromFlowsheet,
    { isLoading: false },
  ],
  useUpdateFlowsheetMutation: () => [
    mockUpdateFlowsheetEntry,
    { isLoading: false },
  ],
  useSwitchEntriesMutation: () => [
    mockSwitchBackendEntries,
    { isLoading: false },
  ],
  flowsheetApi: {
    util: {
      updateQueryData: vi.fn(() => ({ type: "UPDATE_QUERY_DATA" })),
    },
  },
}));

// Mock conversions
vi.mock("@/lib/features/flowsheet/conversions", () => ({
  convertQueryToSubmission: vi.fn((query) => ({
    track_title: query.song,
    artist_name: query.artist,
    album_title: query.album,
    record_label: query.label,
    request_flag: query.request,
    album_id: query.album_id,
  })),
}));

const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const safeCaptureMock = vi.fn();
vi.mock("@/lib/posthog", () => ({
  safeCapture: (...args: unknown[]) => safeCaptureMock(...args),
}));

const createWrapper = () =>
  createHookWrapper({
    flowsheet: flowsheetSlice,
    catalog: catalogSlice,
    liveUpdates: liveUpdatesSlice,
  });

describe("flowsheetHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default values
    mockUseRegistry.mockReturnValue({
      loading: false,
      info: mockUserInfo,
    });
    mockUseWhoIsLiveQuery.mockReturnValue({
      data: mockLiveData,
      isLoading: false,
      isSuccess: true,
    });
    mockUseGetEntriesQuery.mockReturnValue({
      data: mockFlowsheetData,
      isLoading: false,
      isSuccess: true,
      isError: false,
    });
    mockUseGetInfiniteEntriesInfiniteQuery.mockReturnValue({
      data: { pages: [mockFlowsheetData] },
      isLoading: false,
      isSuccess: true,
      isError: false,
      isFetching: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    });
    mockUseCatalogFlowsheetSearch.mockReturnValue({
      searchResults: [],
    });
    mockUseRotationFlowsheetSearch.mockReturnValue({
      searchResults: [],
      loading: false,
    });
    // Clear localStorage
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  describe("useShowControl", () => {
    it("should return live status", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      expect(result.current.live).toBe(true);
    });

    it("should return autoplay status", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.autoplay).toBe("boolean");
    });

    it("should return loading status", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.loading).toBe("boolean");
    });

    it("should return currentShow", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      expect(result.current.currentShow).toBe(100);
    });

    it("should return goLive function", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.goLive).toBe("function");
    });

    it("should return leave function", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.leave).toBe("function");
    });

    it("should return setAutoPlay function", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.setAutoPlay).toBe("function");
    });

    it("should call goLiveFunction when goLive is called", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.goLive();
      });

      expect(mockGoLiveFunction).toHaveBeenCalledWith({
        dj_id: "test-user-1",
        dj_name: "Test DJ",
      });
    });

    it("should pass dj_name_override when goLive is called with an override", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.goLive("Aubrey Hearst");
      });

      expect(mockGoLiveFunction).toHaveBeenCalledWith({
        dj_id: "test-user-1",
        dj_name: "Aubrey Hearst",
        dj_name_override: "Aubrey Hearst",
      });
    });

    it("falls back to real_name for the optimistic dj_name when the DJ has no handle (#621)", () => {
      mockUseRegistry.mockReturnValue({
        loading: false,
        info: {
          ...mockUserInfo,
          dj_name: undefined,
        } as unknown as typeof mockUserInfo,
      });

      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.goLive();
      });

      expect(mockGoLiveFunction).toHaveBeenCalledWith({
        dj_id: "test-user-1",
        dj_name: "Test User",
      });
    });

    it("should omit dj_name_override when goLive is called without one", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.goLive();
      });

      const args = mockGoLiveFunction.mock.calls[0][0];
      expect(args).not.toHaveProperty("dj_name_override");
    });

    it("should omit dj_name_override when goLive is called with undefined", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.goLive(undefined);
      });

      const args = mockGoLiveFunction.mock.calls[0][0];
      expect(args).not.toHaveProperty("dj_name_override");
    });

    it("should call leaveFunction when leave is called", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.leave();
      });

      expect(mockLeaveFunction).toHaveBeenCalledWith({
        dj_id: "test-user-1",
      });
    });

    it("should not call goLive when user is not loaded", () => {
      mockUseRegistry.mockReturnValue({
        loading: true,
        info: null,
      });

      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.goLive();
      });

      expect(mockGoLiveFunction).not.toHaveBeenCalled();
    });

    it("should not call leave when user is not loaded", () => {
      mockUseRegistry.mockReturnValue({
        loading: true,
        info: null,
      });

      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.leave();
      });

      expect(mockLeaveFunction).not.toHaveBeenCalled();
    });

    it("should return live as false when user is not in live list", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { djs: [], onAir: "" },
        isLoading: false,
        isSuccess: true,
      });

      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      expect(result.current.live).toBe(false);
    });

    it("should set autoplay when setAutoPlay is called", () => {
      const { result } = renderHook(() => useShowControl(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setAutoPlay(true);
      });

      expect(typeof result.current.setAutoPlay).toBe("function");
    });
  });

  describe("useFlowsheetSearch", () => {
    it("should return searchOpen status", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.searchOpen).toBe("boolean");
    });

    it("should return setSearchOpen function", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.setSearchOpen).toBe("function");
    });

    it("should return resetSearch function", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.resetSearch).toBe("function");
    });

    it("should return searchQuery", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(result.current.searchQuery).toEqual({
        song: "",
        artist: "",
        album: "",
        label: "",
        request: false,
      });
    });

    it("should return selectedIndex", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.selectedIndex).toBe("number");
    });

    it("should return setSearchProperty function", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.setSearchProperty).toBe("function");
    });

    it("should return getDisplayValue function", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.getDisplayValue).toBe("function");
    });

    it("should return selectedEntry", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      // With selectedIndex 0, selectedEntry should be null
      expect(result.current.selectedEntry).toBeNull();
    });

    it("should update searchOpen when setSearchOpen is called", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchOpen(true);
      });

      expect(result.current.searchOpen).toBe(true);
    });

    it("should reset search when resetSearch is called", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchProperty("artist", "Test Artist");
        result.current.setSearchOpen(true);
      });

      act(() => {
        result.current.resetSearch();
      });

      expect(result.current.searchOpen).toBe(false);
    });

    it("should return raw query value when selectedIndex is 0", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchProperty("artist", "Test Artist");
      });

      const displayValue = result.current.getDisplayValue("artist");
      expect(displayValue).toBe("Test Artist");
    });

    it("should return live status", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.live).toBe("boolean");
    });

    it("should return loading status", () => {
      const { result } = renderHook(() => useFlowsheetSearch(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.loading).toBe("boolean");
    });
  });

  describe("useFlowsheet", () => {
    it("should return entries object with current and previous", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(result.current.entries).toBeDefined();
      expect(Array.isArray(result.current.entries.current)).toBe(true);
      expect(Array.isArray(result.current.entries.previous)).toBe(true);
    });

    it("should return addToFlowsheet function", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.addToFlowsheet).toBe("function");
    });

    it("should return removeFromFlowsheet function", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.removeFromFlowsheet).toBe("function");
    });

    it("should return updateFlowsheet function", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.updateFlowsheet).toBe("function");
    });

    it("should return removeFromQueue function", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.removeFromQueue).toBe("function");
    });

    it("should return loading status", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.loading).toBe("boolean");
    });

    it("should return isSuccess status", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it("should return isError status", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isError).toBe(false);
    });

    it("should call addToFlowsheet mutation", async () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      const submission = {
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      await act(async () => {
        await result.current.addToFlowsheet(submission);
      });

      expect(mockAddToFlowsheet).toHaveBeenCalledWith(submission);
    });

    it("should not call addToFlowsheet when user is not loaded", async () => {
      mockUseRegistry.mockReturnValue({
        loading: true,
        info: null,
      });

      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      const submission = {
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      await expect(
        act(async () => {
          await result.current.addToFlowsheet(submission);
        })
      ).rejects.toEqual("User not logged in");
    });

    it("should call removeFromFlowsheet mutation", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.removeFromFlowsheet(1);
      });

      expect(mockRemoveFromFlowsheet).toHaveBeenCalledWith(1);
    });

    it("should not call removeFromFlowsheet when user is not loaded", () => {
      mockUseRegistry.mockReturnValue({
        loading: true,
        info: null,
      });

      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.removeFromFlowsheet(1);
      });

      expect(mockRemoveFromFlowsheet).not.toHaveBeenCalled();
    });

    it("should call updateFlowsheet mutation", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        entry_id: 1,
        data: { track_title: "Updated Track" },
      };

      act(() => {
        result.current.updateFlowsheet(updateData);
      });

      expect(mockUpdateFlowsheetEntry).toHaveBeenCalledWith(updateData);
    });

    it("should not call updateFlowsheet when user is not loaded", () => {
      mockUseRegistry.mockReturnValue({
        loading: true,
        info: null,
      });

      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        entry_id: 1,
        data: { track_title: "Updated Track" },
      };

      act(() => {
        result.current.updateFlowsheet(updateData);
      });

      expect(mockUpdateFlowsheetEntry).not.toHaveBeenCalled();
    });

    it("should return switchEntries function", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.entries.switchEntries).toBe("function");
    });

    it("should call the switch mutation with the entry id and target position verbatim", async () => {
      mockSwitchBackendEntries.mockClear();

      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      const entry = createTestFlowsheetEntry({
        id: 2,
        show_id: 100,
        play_order: 2,
      });

      await act(async () => {
        await result.current.entries.switchEntries(entry, 7);
      });

      expect(mockSwitchBackendEntries).toHaveBeenCalledTimes(1);
      expect(mockSwitchBackendEntries).toHaveBeenCalledWith({
        entry_id: 2,
        new_position: 7,
      });
    });

    it("should not call the switch mutation when no user is logged in", async () => {
      mockSwitchBackendEntries.mockClear();
      mockUseRegistry.mockReturnValue({
        loading: false,
        info: null,
      });

      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      const entry = createTestFlowsheetEntry({
        id: 2,
        show_id: 100,
        play_order: 2,
      });

      await act(async () => {
        await result.current.entries.switchEntries(entry, 1);
      });

      expect(mockSwitchBackendEntries).not.toHaveBeenCalled();
    });
  });

  describe("useQueue", () => {
    it("should return queue array", () => {
      const { result } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      expect(Array.isArray(result.current.queue)).toBe(true);
    });

    it("should return addToQueue function", () => {
      const { result } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.addToQueue).toBe("function");
    });

    it("should return removeFromQueue function", () => {
      const { result } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.removeFromQueue).toBe("function");
    });

    it("should return loading status", () => {
      const { result } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.loading).toBe("boolean");
    });

    it("should add entry to queue when addToQueue is called and user is live", () => {
      const { result } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      const entry = {
        song: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        label: "Test Label",
        request: false,
      };

      act(() => {
        result.current.addToQueue(entry);
      });

      expect(result.current.queue.length).toBeGreaterThan(0);
    });

    it("should not add entry to queue when user is not live", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { djs: [], onAir: "" },
        isLoading: false,
        isSuccess: true,
      });

      const { result } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      const entry = {
        song: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        label: "Test Label",
        request: false,
      };

      act(() => {
        result.current.addToQueue(entry);
      });

      expect(result.current.queue.length).toBe(0);
    });

    it("should remove entry from queue when removeFromQueue is called", () => {
      const { result } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      const entry = {
        song: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        label: "Test Label",
        request: false,
      };

      act(() => {
        result.current.addToQueue(entry);
      });

      const entryId = result.current.queue[0]?.id;

      act(() => {
        result.current.removeFromQueue(entryId);
      });

      expect(result.current.queue.length).toBe(0);
    });

    it("should not remove entry when user is not live", () => {
      // Start as not live - removeFromQueue should do nothing
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { djs: [], onAir: "" },
        isLoading: false,
        isSuccess: true,
      });

      const { result } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      // Try to remove - should just return without doing anything
      act(() => {
        result.current.removeFromQueue(0);
      });

      // This should not throw and queue should remain empty
      expect(result.current.queue.length).toBe(0);
    });

    it("does not clear the queue during a transient WhoIsLive refetch (#644)", () => {
      // Add an entry while live and settled.
      const { result, rerender } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addToQueue({
          song: "Test Song",
          artist: "Test Artist",
          album: "Test Album",
          label: "Test Label",
          request: false,
        });
      });
      expect(result.current.queue.length).toBe(1);

      // Invalidate→refetch window: WhoIsLive momentarily reads off-air while
      // isFetching is true. The old !loading gate would have cleared here.
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { djs: [], onAir: "" },
        isLoading: false,
        isSuccess: true,
        isFetching: true,
      } as ReturnType<typeof mockUseWhoIsLiveQuery>);
      rerender();
      expect(result.current.queue.length).toBe(1);

      // Refetch settles and confirms the DJ is still live: still no clear.
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockLiveData,
        isLoading: false,
        isSuccess: true,
        isFetching: false,
      } as ReturnType<typeof mockUseWhoIsLiveQuery>);
      rerender();
      expect(result.current.queue.length).toBe(1);
    });

    it("clears the queue after two consecutive settled off-air reads (#644)", () => {
      const { result, rerender } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addToQueue({
          song: "Test Song",
          artist: "Test Artist",
          album: "Test Album",
          label: "Test Label",
          request: false,
        });
      });
      expect(result.current.queue.length).toBe(1);

      // First settled off-air read: could be stale (see the post-join test
      // below), so no clear yet.
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { djs: [], onAir: "" },
        isLoading: false,
        isSuccess: true,
        isFetching: false,
      } as ReturnType<typeof mockUseWhoIsLiveQuery>);
      rerender();
      expect(result.current.queue.length).toBe(1);

      // Next poll cycle: refetch...
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { djs: [], onAir: "" },
        isLoading: false,
        isSuccess: true,
        isFetching: true,
      } as ReturnType<typeof mockUseWhoIsLiveQuery>);
      rerender();
      expect(result.current.queue.length).toBe(1);

      // ...settles off-air again: the DJ genuinely ended the show, so clear.
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { djs: [], onAir: "" },
        isLoading: false,
        isSuccess: true,
        isFetching: false,
      } as ReturnType<typeof mockUseWhoIsLiveQuery>);
      rerender();
      expect(result.current.queue.length).toBe(0);
    });

    it("survives a settled-but-stale off-air read right after join (#644)", () => {
      // join fulfilled → invalidate → the refetch can settle BEFORE the
      // backend registers the DJ, yielding a settled empty-djs read. One such
      // read must not wipe the queue.
      const { result, rerender } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addToQueue({
          song: "Test Song",
          artist: "Test Artist",
          album: "Test Album",
          label: "Test Label",
          request: false,
        });
      });
      expect(result.current.queue.length).toBe(1);

      // Invalidation refetch in flight.
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockLiveData,
        isLoading: false,
        isSuccess: true,
        isFetching: true,
      } as ReturnType<typeof mockUseWhoIsLiveQuery>);
      rerender();

      // Refetch settles with a stale empty roster: queue must survive.
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { djs: [], onAir: "" },
        isLoading: false,
        isSuccess: true,
        isFetching: false,
      } as ReturnType<typeof mockUseWhoIsLiveQuery>);
      rerender();
      expect(result.current.queue.length).toBe(1);

      // Next poll corrects the roster: still live, still intact.
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockLiveData,
        isLoading: false,
        isSuccess: true,
        isFetching: true,
      } as ReturnType<typeof mockUseWhoIsLiveQuery>);
      rerender();
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockLiveData,
        isLoading: false,
        isSuccess: true,
        isFetching: false,
      } as ReturnType<typeof mockUseWhoIsLiveQuery>);
      rerender();
      expect(result.current.queue.length).toBe(1);
    });

    it("clears the queue on logout even though the WhoIsLive subscription is skipped (#644)", () => {
      const { result, rerender } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addToQueue({
          song: "Test Song",
          artist: "Test Artist",
          album: "Test Album",
          label: "Test Label",
          request: false,
        });
      });
      expect(result.current.queue.length).toBe(1);

      // Logout: useRegistry reports loading whenever unauthenticated, and the
      // WhoIsLive query is skipped — the settled gate can never fire, so the
      // signed-in → signed-out transition must clear directly.
      mockUseRegistry.mockReturnValue({
        loading: true,
        info: null,
      });
      rerender();

      expect(result.current.queue.length).toBe(0);
      // clearQueue's reducer also drops the persisted copy
      // (localStorage is the vi.fn stub from vitest.setup.ts).
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        "wxyc_flowsheet_queue"
      );
    });

    it("should handle removeFromQueue call when already live then user goes offline", () => {
      // First add an entry while live
      const { result, rerender } = renderHook(() => useQueue(), {
        wrapper: createWrapper(),
      });

      const entry = {
        song: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        label: "Test Label",
        request: false,
      };

      act(() => {
        result.current.addToQueue(entry);
      });

      const entryId = result.current.queue[0]?.id;
      expect(result.current.queue.length).toBe(1);

      // Then mock not live
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { djs: [], onAir: "" },
        isLoading: false,
        isSuccess: true,
      });

      rerender();

      // Try to remove while not live - the early return should be hit
      act(() => {
        result.current.removeFromQueue(entryId);
      });
    });
  });

  describe("useFlowsheetSubmit", () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      addEventListenerSpy = vi.spyOn(document, "addEventListener");
      removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    });

    afterEach(() => {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it("should return ctrlKeyPressed state", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.ctrlKeyPressed).toBe("boolean");
      expect(result.current.ctrlKeyPressed).toBe(false);
    });

    describe("visible-index → submission mapping under the render cap (#657)", () => {
      // 500 catalog rows, only 50 painted. bin/rotation/lml are empty, so
      // the catalog section starts at visible index 1 and its last VISIBLE
      // row is index 50 → catalogResults[49].
      const manyAlbums = Array.from({ length: 500 }, (_, i) =>
        createTestAlbum({
          id: 1000 + i,
          title: `Cap Album ${i}`,
          artist: createTestArtist({ name: "Juana Molina" }),
        })
      );

      const wrapperWithSelected = (selectedResult: number) =>
        createHookWrapper(
          { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
          {
            flowsheet: {
              ...flowsheetSlice.getInitialState(),
              search: {
                ...flowsheetSlice.getInitialState().search,
                selectedResult,
                query: {
                  ...flowsheetSlice.getInitialState().search.query,
                  song: "la paradoja",
                },
              },
            },
          }
        );

      it("resolves the last visible capped row to exactly that album", () => {
        mockUseCatalogFlowsheetSearch.mockReturnValue({
          searchResults: manyAlbums,
        });

        const { result } = renderHook(() => useFlowsheetSubmit(), {
          wrapper: wrapperWithSelected(50),
        });

        // Index 50 is the 50th (last painted) catalog row → manyAlbums[49].
        expect(result.current.selectedResultData.album).toBe("Cap Album 49");
        expect(result.current.selectedResultData.album_id).toBe(1049);
      });

      it("treats an index beyond the visible cap as manual entry, never an unseen album", () => {
        mockUseCatalogFlowsheetSearch.mockReturnValue({
          searchResults: manyAlbums,
        });

        const { result } = renderHook(() => useFlowsheetSubmit(), {
          wrapper: wrapperWithSelected(51),
        });

        // The nav bound stops at 50, but even a stale/forced 51 must not map
        // onto a hidden row — it falls back to the raw typed query.
        expect(result.current.selectedResultData.album_id).toBeUndefined();
        expect(result.current.selectedResultData.album).toBe("");
      });
    });

    it("should return handleSubmit function", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.handleSubmit).toBe("function");
    });

    it("should return binResults array", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      expect(Array.isArray(result.current.binResults)).toBe(true);
    });

    it("should return catalogResults array", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      expect(Array.isArray(result.current.catalogResults)).toBe(true);
    });

    it("should return rotationResults array", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      expect(Array.isArray(result.current.rotationResults)).toBe(true);
    });

    it("should return selectedResultData", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      expect(result.current.selectedResultData).toBeDefined();
      expect(result.current.selectedResultData.song).toBeDefined();
      expect(result.current.selectedResultData.artist).toBeDefined();
      expect(result.current.selectedResultData.album).toBeDefined();
      expect(result.current.selectedResultData.label).toBeDefined();
    });

    it("should return selectedEntry", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      // With selectedResult 0, selectedEntry should be null
      expect(result.current.selectedEntry).toBeNull();
    });

    it("should set up keyboard event listeners", () => {
      renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function)
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function)
      );
    });

    // Dedicated queue button path — same guard/reset as Ctrl+Enter, minus
    // the modifier.
    describe("submitToQueue", () => {
      const renderCombined = () =>
        renderHook(
          () => ({
            submit: useFlowsheetSubmit(),
            queue: useQueue(),
            search: useFlowsheetSearch(),
            dispatch: useAppDispatch(),
          }),
          { wrapper: createWrapper() }
        );

      it("rejects a songless entry and leaves the search intact", () => {
        const { result } = renderCombined();

        act(() => {
          result.current.search.setSearchProperty("artist", "Stereolab");
        });
        act(() => {
          result.current.submit.submitToQueue();
        });

        expect(result.current.queue.queue.length).toBe(0);
        expect(result.current.search.searchQuery.artist).toBe("Stereolab");
      });

      it("queues the typed entry and resets the search", () => {
        const { result } = renderCombined();

        act(() => {
          result.current.search.setSearchProperty("artist", "Juana Molina");
          result.current.search.setSearchProperty("song", "Eras");
        });
        act(() => {
          result.current.submit.submitToQueue();
        });

        expect(result.current.queue.queue.length).toBe(1);
        expect(result.current.queue.queue[0].track_title).toBe("Eras");
        expect(result.current.search.searchQuery.song).toBe("");
        expect(result.current.search.searchQuery.artist).toBe("");
      });

      it("drops a synthesized negative album_id but keeps rotation linkage on the queue path", () => {
        const { result } = renderCombined();

        act(() => {
          result.current.dispatch(
            flowsheetSlice.actions.freezeSelectionToQuery({
              artist: "Chuquimamani-Condori",
              album: "DJ E",
              label: "",
              album_id: -42,
              rotation_id: 7,
              rotation_bin: "H",
            })
          );
          result.current.search.setSearchProperty("song", "Prayer");
        });
        act(() => {
          result.current.submit.submitToQueue();
        });

        expect(result.current.queue.queue.length).toBe(1);
        const queued = result.current.queue.queue[0];
        // The synthesized negative id must not reach the queue (SongEntry
        // "Play Now" would forward it to BS and 500), but rotation_id/rotation
        // ride the freeform variant so the library-unlinked rotation pick keeps
        // its badge and propagates as rotation to the wxyc.info archive.
        expect(queued.album_id).toBeUndefined();
        expect(queued.rotation_id).toBe(7);
        expect(queued.rotation).toBe("H");
      });
    });

    it("should clean up keyboard event listeners on unmount", () => {
      const { unmount } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function)
      );
    });

    it("should set ctrlKeyPressed to true on Control keydown", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Control" });
        document.dispatchEvent(event);
      });

      expect(result.current.ctrlKeyPressed).toBe(true);
    });

    it("should set ctrlKeyPressed to false on Control keyup", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      act(() => {
        const keydownEvent = new KeyboardEvent("keydown", { key: "Control" });
        document.dispatchEvent(keydownEvent);
      });

      expect(result.current.ctrlKeyPressed).toBe(true);

      act(() => {
        const keyupEvent = new KeyboardEvent("keyup", { key: "Control" });
        document.dispatchEvent(keyupEvent);
      });

      expect(result.current.ctrlKeyPressed).toBe(false);
    });

    it("should call handleSubmit and add to flowsheet when ctrl is not pressed", () => {
      // Preload a song title — handleSubmit now requires it (covers the
      // row-click bypass of the form's HTML5 validation; see the
      // "song-title validation" describe block below).
      const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              query: {
                ...flowsheetSlice.getInitialState().search.query,
                song: "la paradoja",
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper,
      });

      act(() => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(mockAddToFlowsheet).toHaveBeenCalled();
    });

    it("should not ignore non-Control keys", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Shift" });
        document.dispatchEvent(event);
      });

      expect(result.current.ctrlKeyPressed).toBe(false);
    });

    it("should call addToQueue when handleSubmit is called with ctrl pressed", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      // Press control key
      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Control" });
        document.dispatchEvent(event);
      });

      expect(result.current.ctrlKeyPressed).toBe(true);

      // Call handleSubmit while ctrl is pressed
      act(() => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      // addToQueue should have been called instead of addToFlowsheet
      // The dispatch should have been called with the queue action
    });

    it("treats Meta (Cmd) keydown the same as Control", () => {
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta" }));
      });
      expect(result.current.ctrlKeyPressed).toBe(true);

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta" }));
      });
      expect(result.current.ctrlKeyPressed).toBe(false);
    });

    // Dispatching keydown without an act() wrap leaves the React state
    // uncommitted before handleSubmit fires — the same race the production
    // form's implicit submit exposes when Ctrl+Enter is pressed quickly.
    it("routes submission to queue even when the keydown state hasn't been observed yet", () => {
      const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              query: {
                ...flowsheetSlice.getInitialState().search.query,
                song: "la paradoja",
                artist: "Juana Molina",
                album: "DOGA",
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      act(() => {
        result.current.handleSubmit({
          preventDefault: vi.fn(),
        } as unknown as FormEvent);
      });

      expect(mockAddToFlowsheet).not.toHaveBeenCalled();
    });

    it("should include selectedEntry values in selectedResultData when selectedResult > 0", () => {
      // Mock search results with an album entry
      const mockAlbum = createTestAlbum({
        id: 123,
        title: "Album From Search",
        label: "Label From Search",
        rotation_id: 456,
        artist: createTestArtist({ name: "Artist From Search" }),
      });

      mockUseCatalogFlowsheetSearch.mockReturnValue({
        searchResults: [mockAlbum],
      });

      // Create wrapper with preloaded state where selectedResult > 0
      const customWrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              selectedResult: 1,
              query: {
                song: "Test Song",
                artist: "User Artist",
                album: "User Album",
                label: "User Label",
                request: false,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: customWrapper,
      });

      // With selectedResult > 0, the hook should look up the selectedEntry
      // and use its values (with fallback to user input for song)
      expect(result.current.selectedResultData).toBeDefined();
      expect(result.current.selectedResultData.song).toBe("Test Song");
      expect(result.current.selectedResultData.artist).toBe("Artist From Search");
      expect(result.current.selectedResultData.album).toBe("Album From Search");
      expect(result.current.selectedResultData.label).toBe("Label From Search");
      expect(result.current.selectedResultData.album_id).toBe(123);
      expect(result.current.selectedResultData.rotation_id).toBe(456);
    });

    it("should forward track_position from flowSheetRawQuery into selectedResultData", () => {
      // When the picker dispatches setTrackPosition, it writes to
      // flowsheet.search.query.track_position. The selectedResultData memo
      // must forward that field so convertQueryToSubmission emits it on the
      // outbound POST. Without this, picker selections silently lose
      // track_position before reaching the wire (regression-guard for #502).
      const mockAlbum = createTestAlbum({ id: 555, title: "DOGA" });

      mockUseCatalogFlowsheetSearch.mockReturnValue({
        searchResults: [mockAlbum],
      });

      const customWrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              selectedResult: 1,
              query: {
                song: "la paradoja",
                artist: "Juana Molina",
                album: "DOGA",
                label: "Sonamos",
                request: false,
                track_position: "A1",
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: customWrapper,
      });

      expect(result.current.selectedResultData.track_position).toBe("A1");
    });

    it("should leave track_position undefined when no track was picked", () => {
      const mockAlbum = createTestAlbum({ id: 556, title: "Edits" });

      mockUseCatalogFlowsheetSearch.mockReturnValue({
        searchResults: [mockAlbum],
      });

      const customWrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              selectedResult: 1,
              query: {
                song: "Call Your Name",
                artist: "Chuquimamani-Condori",
                album: "Edits",
                label: "self-released",
                request: false,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: customWrapper,
      });

      expect(result.current.selectedResultData.track_position).toBeUndefined();
    });

    it("should forward track_position from flowSheetRawQuery in the manual-entry branch (selectedResult == 0)", () => {
      // Manual-entry branch of the selectedResultData memo: when no result is
      // highlighted (selectedResult === 0), the DJ is typing free-form. The
      // picker doesn't fire here, but the field is still forwarded
      // defensively — and the fix touches both arms of the memo, so both
      // arms need coverage to prevent a future regression in either branch.
      const customWrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              selectedResult: 0,
              query: {
                song: "la paradoja",
                artist: "Juana Molina",
                album: "DOGA",
                label: "Sonamos",
                request: false,
                track_position: "A1",
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: customWrapper,
      });

      expect(result.current.selectedResultData.track_position).toBe("A1");
    });

    it("forwards the toggled request flag in the manual-entry branch (selectedResult == 0) (#602)", () => {
      // A call-in request typed free-form: toggleRequest set query.request
      // true, and the manual-entry branch of selectedResultData must forward
      // it so convertQueryToSubmission emits request_flag: true.
      const customWrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              selectedResult: 0,
              query: {
                song: "la paradoja",
                artist: "Juana Molina",
                album: "DOGA",
                label: "Sonamos",
                request: true,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: customWrapper,
      });

      expect(result.current.selectedResultData.request).toBe(true);
    });

    it("forwards the toggled request flag in the selected-result branch (selectedResult > 0) (#602)", () => {
      const mockAlbum = createTestAlbum({ id: 321, title: "DOGA" });
      mockUseCatalogFlowsheetSearch.mockReturnValue({
        searchResults: [mockAlbum],
      });

      const customWrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              selectedResult: 1,
              query: {
                song: "la paradoja",
                artist: "Juana Molina",
                album: "DOGA",
                label: "Sonamos",
                request: true,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: customWrapper,
      });

      expect(result.current.selectedResultData.request).toBe(true);
    });

    it("should use fallback values from flowSheetRawQuery when selectedEntry has missing values", () => {
      // Mock search results with an album entry that has missing values
      const mockAlbum = createTestAlbum({
        id: 789,
        title: "", // empty title
        label: "", // empty label
        artist: null as any, // no artist
      });

      mockUseCatalogFlowsheetSearch.mockReturnValue({
        searchResults: [mockAlbum],
      });

      // When selectedEntry exists but has no artist/title/label,
      // it should fall back to the user's entered values
      const customWrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              selectedResult: 1,
              query: {
                song: "Fallback Song",
                artist: "Fallback Artist",
                album: "Fallback Album",
                label: "Fallback Label",
                request: false,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: customWrapper,
      });

      expect(result.current.selectedResultData.song).toBe("Fallback Song");
      expect(result.current.selectedResultData.artist).toBe("Fallback Artist");
      expect(result.current.selectedResultData.album).toBe("Fallback Album");
      expect(result.current.selectedResultData.label).toBe("Fallback Label");
    });

    describe("handleSubmit song-title validation", () => {
      // Catalog/LML result rows wire `onClick={handleSubmit}` (see
      // FlowsheetBackendResult.tsx), which sidesteps the form's HTML5
      // `required` on the song input. handleSubmit must reject empty
      // song titles on every submission path.
      const mkPreloaded = (song: string) => ({
        flowsheet: {
          ...flowsheetSlice.getInitialState(),
          search: {
            ...flowsheetSlice.getInitialState().search,
            selectedResult: 0,
            query: {
              song,
              artist: "Juana Molina",
              album: "DOGA",
              label: "Sonamos",
              request: false,
            },
          },
        },
      });

      it("rejects submission when song is empty and does not call addToFlowsheet", async () => {
        const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
          mkPreloaded("")
        );

        const { result } = renderHook(() => useFlowsheetSubmit(), {
          wrapper,
        });

        await act(async () => {
          await result.current.handleSubmit({
            preventDefault: vi.fn(),
          } as unknown as FormEvent);
        });

        expect(mockAddToFlowsheet).not.toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringMatching(/song title is required/i)
        );
      });

      it("rejects submission when song is whitespace-only", async () => {
        const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
          mkPreloaded("   ")
        );

        const { result } = renderHook(() => useFlowsheetSubmit(), {
          wrapper,
        });

        await act(async () => {
          await result.current.handleSubmit({
            preventDefault: vi.fn(),
          } as unknown as FormEvent);
        });

        expect(mockAddToFlowsheet).not.toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalled();
      });

      it("submits normally when song is present", async () => {
        const wrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
          mkPreloaded("la paradoja")
        );

        const { result } = renderHook(() => useFlowsheetSubmit(), {
          wrapper,
        });

        await act(async () => {
          await result.current.handleSubmit({
            preventDefault: vi.fn(),
          } as unknown as FormEvent);
        });

        expect(mockAddToFlowsheet).toHaveBeenCalledTimes(1);
        expect(mockToastError).not.toHaveBeenCalled();
      });
    });

    it("should return selectedEntry when selectedResult > 0 and results exist", () => {
      // Mock search results
      const mockAlbum = createTestAlbum({
        id: 999,
        title: "Selected Album",
        label: "Selected Label",
        artist: createTestArtist({ name: "Selected Artist" }),
      });

      mockUseCatalogFlowsheetSearch.mockReturnValue({
        searchResults: [mockAlbum],
      });

      const customWrapper = createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              selectedResult: 1,
              query: {
                song: "Test",
                artist: "",
                album: "",
                label: "",
                request: false,
              },
            },
          },
        }
      );

      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: customWrapper,
      });

      // selectedEntry should be the album from search results
      expect(result.current.selectedEntry).toBeDefined();
      expect(result.current.selectedEntry?.id).toBe(999);
    });

    describe("flowsheet_submit_rotation_link telemetry", () => {
      const rotationWrapper = (rotationOverrides: { rotation_id?: number } = {}) => {
        const rotationAlbum = createTestAlbum({
          id: 111,
          title: "DOGA",
          label: "Sonamos",
          artist: createTestArtist({ name: "Juana Molina" }),
          ...rotationOverrides,
        });
        mockUseRotationFlowsheetSearch.mockReturnValue({
          searchResults: [rotationAlbum],
          loading: false,
        });
        return createHookWrapper(
          { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
          {
            flowsheet: {
              ...flowsheetSlice.getInitialState(),
              search: {
                ...flowsheetSlice.getInitialState().search,
                selectedResult: 1,
                query: {
                  song: "la paradoja",
                  artist: "",
                  album: "",
                  label: "",
                  request: false,
                },
              },
            },
          }
        );
      };

      it("fires with rotation_id_present:true when the rotation-picked entry has rotation_id set", async () => {
        const wrapper = rotationWrapper({ rotation_id: 222 });
        const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

        await act(async () => {
          await result.current.handleSubmit({
            preventDefault: vi.fn(),
          } as unknown as FormEvent);
        });

        expect(safeCaptureMock).toHaveBeenCalledWith(
          "flowsheet_submit_rotation_link",
          {
            rotation_id_present: true,
            rotation_id: 222,
            album_id_present: true,
          }
        );
      });

      it("fires with rotation_id_present:false when the rotation-picked entry has no rotation_id", async () => {
        const wrapper = rotationWrapper();
        const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

        await act(async () => {
          await result.current.handleSubmit({
            preventDefault: vi.fn(),
          } as unknown as FormEvent);
        });

        expect(safeCaptureMock).toHaveBeenCalledWith(
          "flowsheet_submit_rotation_link",
          {
            rotation_id_present: false,
            rotation_id: null,
            album_id_present: true,
          }
        );
      });

      it("does not fire for a non-rotation (catalog) pick", async () => {
        const catalogAlbum = createTestAlbum({
          id: 333,
          title: "On Your Own Love Again",
          artist: createTestArtist({ name: "Jessica Pratt" }),
        });
        mockUseCatalogFlowsheetSearch.mockReturnValue({
          searchResults: [catalogAlbum],
        });

        const wrapper = createHookWrapper(
          { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
          {
            flowsheet: {
              ...flowsheetSlice.getInitialState(),
              search: {
                ...flowsheetSlice.getInitialState().search,
                selectedResult: 1,
                query: {
                  song: "la paradoja",
                  artist: "",
                  album: "",
                  label: "",
                  request: false,
                },
              },
            },
          }
        );

        const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

        await act(async () => {
          await result.current.handleSubmit({
            preventDefault: vi.fn(),
          } as unknown as FormEvent);
        });

        expect(mockAddToFlowsheet).toHaveBeenCalled();
        expect(safeCaptureMock).not.toHaveBeenCalled();
      });

      it("does not fire for a freeform (typed, no selection) submit", async () => {
        const wrapper = createHookWrapper(
          { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
          {
            flowsheet: {
              ...flowsheetSlice.getInitialState(),
              search: {
                ...flowsheetSlice.getInitialState().search,
                selectedResult: 0,
                query: {
                  song: "la paradoja",
                  artist: "Juana Molina",
                  album: "DOGA",
                  label: "Sonamos",
                  request: false,
                },
              },
            },
          }
        );

        const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

        await act(async () => {
          await result.current.handleSubmit({
            preventDefault: vi.fn(),
          } as unknown as FormEvent);
        });

        expect(mockAddToFlowsheet).toHaveBeenCalled();
        expect(safeCaptureMock).not.toHaveBeenCalled();
      });

      it("does not fire when addToQueue (Ctrl+Enter) is used instead of a direct flowsheet submit", async () => {
        const wrapper = rotationWrapper({ rotation_id: 222 });
        const { result } = renderHook(() => useFlowsheetSubmit(), { wrapper });

        act(() => {
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Control" })
          );
        });

        await act(async () => {
          await result.current.handleSubmit({
            preventDefault: vi.fn(),
          } as unknown as FormEvent);
        });

        expect(mockAddToFlowsheet).not.toHaveBeenCalled();
        expect(safeCaptureMock).not.toHaveBeenCalled();
      });
    });
  });

  // The search view (useFlowsheetSearch) and the submit path (useFlowsheetSubmit)
  // now resolve the selected result through one shared pipeline
  // (useFlowsheetSearchResults). This proves the #657 invariant structurally:
  // for the same query and selectedResult, the album the view highlights and the
  // album the submission carries are always the same one — including at the
  // MAX_VISIBLE_RESULTS cap boundary where a divergent second copy could drift.
  describe("search view / submit agreement for the same query (#657)", () => {
    const manyAlbums = Array.from({ length: 500 }, (_, i) =>
      createTestAlbum({
        id: 2000 + i,
        title: `Agree Album ${i}`,
        artist: createTestArtist({ name: "Juana Molina" }),
      })
    );

    const wrapperWithSelected = (selectedResult: number) =>
      createHookWrapper(
        { flowsheet: flowsheetSlice, liveUpdates: liveUpdatesSlice },
        {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              selectedResult,
              query: {
                ...flowsheetSlice.getInitialState().search.query,
                song: "la paradoja",
              },
            },
          },
        }
      );

    const renderBoth = (selectedResult: number) =>
      renderHook(
        () => ({ search: useFlowsheetSearch(), submit: useFlowsheetSubmit() }),
        { wrapper: wrapperWithSelected(selectedResult) }
      );

    it("resolves the highlighted view row and the submitted entry to the same album", () => {
      mockUseCatalogFlowsheetSearch.mockReturnValue({ searchResults: manyAlbums });

      const { result } = renderBoth(10);

      const viewEntry = result.current.search.selectedEntry;
      const submitEntry = result.current.submit.selectedEntry;

      expect(viewEntry).not.toBeNull();
      expect(viewEntry?.id).toBe(submitEntry?.id);
      expect(result.current.submit.selectedResultData.album_id).toBe(viewEntry?.id);
      expect(result.current.submit.selectedResultData.album).toBe(viewEntry?.title);
      // What the view input paints must equal what the submission carries.
      expect(result.current.search.getDisplayValue("album")).toBe(
        result.current.submit.selectedResultData.album
      );
    });

    it("agrees at the last visible capped row (index 50 → the 50th painted album)", () => {
      mockUseCatalogFlowsheetSearch.mockReturnValue({ searchResults: manyAlbums });

      const { result } = renderBoth(50);

      expect(result.current.search.selectedEntry?.id).toBe(2049);
      expect(result.current.submit.selectedEntry?.id).toBe(2049);
      expect(result.current.submit.selectedResultData.album_id).toBe(2049);
    });

    it("agrees on manual entry past the visible cap — never an unseen album (index 51)", () => {
      mockUseCatalogFlowsheetSearch.mockReturnValue({ searchResults: manyAlbums });

      const { result } = renderBoth(51);

      expect(result.current.search.selectedEntry).toBeNull();
      expect(result.current.submit.selectedEntry).toBeNull();
      expect(result.current.submit.selectedResultData.album_id).toBeUndefined();
    });
  });
});
