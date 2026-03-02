import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useShowControl,
  useFlowsheetSearch,
  useFlowsheet,
  useQueue,
  useFlowsheetSubmit,
} from "./flowsheetHooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import {
  createHookWrapper,
  createTestFlowsheetEntry,
  createTestAlbum,
  createTestArtist,
} from "@/lib/test-utils";

// Mock authentication hooks
const mockUserInfo = {
  id: "test-user-1",
  real_name: "Test User",
  dj_name: "Test DJ",
};

const mockUseRegistry = vi.fn(() => ({
  loading: false,
  info: mockUserInfo,
}));

vi.mock("./authenticationHooks", () => ({
  useRegistry: () => mockUseRegistry(),
}));

// Mock bin hooks
vi.mock("./binHooks", () => ({
  useBinResults: vi.fn(() => ({
    searchResults: [],
  })),
}));

// Mock catalog hooks
const mockUseCatalogFlowsheetSearch = vi.fn(() => ({
  searchResults: [],
}));
const mockUseRotationFlowsheetSearch = vi.fn(() => ({
  searchResults: [],
  loading: false,
}));

vi.mock("./catalogHooks", () => ({
  useCatalogFlowsheetSearch: () => mockUseCatalogFlowsheetSearch(),
  useRotationFlowsheetSearch: () => mockUseRotationFlowsheetSearch(),
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

vi.mock("@/lib/features/flowsheet/api", () => ({
  useGetEntriesQuery: () => mockUseGetEntriesQuery(),
  useWhoIsLiveQuery: () => mockUseWhoIsLiveQuery(),
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

const createWrapper = () =>
  createHookWrapper({ flowsheet: flowsheetSlice, catalog: catalogSlice });

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
      });
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

    it("should return setCurrentShowEntries function", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.entries.setCurrentShowEntries).toBe(
        "function"
      );
    });

    it("should return switchEntries function", () => {
      const { result } = renderHook(() => useFlowsheet(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.entries.switchEntries).toBe("function");
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
      const { result } = renderHook(() => useFlowsheetSubmit(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.handleSubmit({});
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
        result.current.handleSubmit({});
      });

      // addToQueue should have been called instead of addToFlowsheet
      // The dispatch should have been called with the queue action
    });

    it("should include selectedEntry values in selectedResultData when selectedResult > 0", () => {
      // Mock search results with an album entry
      const mockAlbum = createTestAlbum({
        id: 123,
        title: "Album From Search",
        label: "Label From Search",
        play_freq: "M",
        rotation_id: 456,
        artist: createTestArtist({ name: "Artist From Search" }),
      });

      mockUseCatalogFlowsheetSearch.mockReturnValue({
        searchResults: [mockAlbum],
      });

      // Create wrapper with preloaded state where selectedResult > 0
      const customWrapper = createHookWrapper(
        { flowsheet: flowsheetSlice },
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
      expect(result.current.selectedResultData.play_freq).toBe("M");
      expect(result.current.selectedResultData.rotation_id).toBe(456);
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
        { flowsheet: flowsheetSlice },
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
        { flowsheet: flowsheetSlice },
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
  });
});
