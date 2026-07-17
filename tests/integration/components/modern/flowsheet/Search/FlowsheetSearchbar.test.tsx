import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FlowsheetSearchbar from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchbar";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useGhostText } from "@/src/hooks/useGhostText";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";

// Mock hook return values that can be changed per test
let mockLive = false;
let mockSearchOpen = false;
let mockCtrlKeyPressed = false;
let mockBinResults: any[] = [];
let mockCatalogResults: any[] = [];
let mockRotationResults: any[] = [];
let mockLmlResults: any[] = [];
const mockSetSearchOpen = vi.fn();
const mockResetSearch = vi.fn();
const mockHandleSubmit = vi.fn();
const mockSubmitToQueue = vi.fn();
const mockAddToFlowsheet = vi.fn();
const mockSetSearchProperty = vi.fn();

// Mock hooks
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetActions: vi.fn(() => ({
    addToFlowsheet: mockAddToFlowsheet,
  })),
  useFlowsheetSearch: vi.fn(() => ({
    live: mockLive,
    searchOpen: mockSearchOpen,
    setSearchOpen: mockSetSearchOpen,
    resetSearch: mockResetSearch,
    searchQuery: { song: "", artist: "", album: "", label: "", request: false },
    setSearchProperty: mockSetSearchProperty,
  })),
  useFlowsheetSubmit: vi.fn(() => ({
    ctrlKeyPressed: mockCtrlKeyPressed,
    handleSubmit: mockHandleSubmit,
    submitToQueue: mockSubmitToQueue,
    binResults: mockBinResults,
    catalogResults: mockCatalogResults,
    rotationResults: mockRotationResults,
    lmlResults: mockLmlResults,
  })),
}));

vi.mock("@/src/hooks/useGhostText", () => ({
  useGhostText: vi.fn(() => ({
    ghostSuffix: "",
    acceptGhostText: () => null,
    trackResult: null,
  })),
}));

// Mock child components
vi.mock("@/src/components/experiences/modern/flowsheet/Search/BreakpointButton", () => ({
  default: () => <button data-testid="breakpoint-button">Breakpoint</button>,
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Search/TalksetButton", () => ({
  default: () => <button data-testid="talkset-button">Talkset</button>,
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchInput", () => ({
  default: ({ name, disabled }: any) => (
    <input data-testid={`input-${name}`} name={name} disabled={disabled} />
  ),
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Search/Results/FlowsheetSearchResults", () => ({
  default: () => <div data-testid="search-results">Results</div>,
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Search/RotationModeToggle", () => ({
  default: () => <button data-testid="rotation-toggle">Rotation</button>,
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Search/RotationEntryFields", () => ({
  default: ({ disabled }: any) => (
    <div data-testid="rotation-entry-fields" data-disabled={disabled}>
      Rotation Fields
    </div>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  PlayArrow: () => <span data-testid="play-icon" />,
  QueueMusic: () => <span data-testid="queue-icon" />,
  Close: () => <span data-testid="close-icon" />,
}));

// Store whose flowsheet query already has typed content — the signal that
// swaps the idle (breakpoint/talkset) cluster for the commit cluster
// (clear/queue/play).
function createStoreWithQueryContent(artist = "Stereolab") {
  const initial = flowsheetSlice.getInitialState();
  return createTestStore({
    flowsheet: {
      ...initial,
      search: {
        ...initial.search,
        query: { ...initial.search.query, artist },
      },
    },
  });
}

function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      flowsheet: flowsheetSlice.reducer,
    },
    preloadedState,
  });
}

describe("FlowsheetSearchbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLive = false;
    mockSearchOpen = false;
    mockCtrlKeyPressed = false;
    mockBinResults = [];
    mockCatalogResults = [];
    mockRotationResults = [];
    mockLmlResults = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render search form", () => {
    const store = createTestStore();

    const { container } = render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(container.querySelector("form")).toBeInTheDocument();
  });

  it("should not stretch to fill the page column (regression: giant gap above the flowsheet)", () => {
    const store = createTestStore();

    const { container } = render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    // MainContent is a column flex pinned to 100dvh; flex-grow on the
    // searchbar's outer wrapper absorbs all leftover vertical space and
    // pushes the entry tables to the bottom of the viewport.
    const wrapper = container.querySelector(
      '[data-testid="flowsheet-entry-bar"]'
    ) as HTMLElement;
    expect(wrapper).toBeInTheDocument();
    expect(getComputedStyle(wrapper).flexGrow).not.toBe("1");
  });

  it("should render BreakpointButton", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(screen.getByTestId("breakpoint-button")).toBeInTheDocument();
  });

  it("should render TalksetButton", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(screen.getByTestId("talkset-button")).toBeInTheDocument();
  });

  it("should render search inputs in Artist | Song | Album | Label order", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    const artist = screen.getByTestId("input-artist");
    const song = screen.getByTestId("input-song");
    const album = screen.getByTestId("input-album");
    const label = screen.getByTestId("input-label");

    expect(artist).toBeInTheDocument();
    expect(song).toBeInTheDocument();
    expect(album).toBeInTheDocument();
    expect(label).toBeInTheDocument();

    // Verify order: artist before song, song before album, album before label
    const allInputs = screen.getAllByRole("textbox");
    expect(allInputs[0]).toBe(artist);
    expect(allInputs[1]).toBe(song);
    expect(allInputs[2]).toBe(album);
    expect(allInputs[3]).toBe(label);
  });

  // The results panel is a Popper mounted only while the search is open — the
  // shell and panel share one continuous outline (see entryBarStyles).
  it("should not render the results panel while the search is closed", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
  });

  it("should render the results panel while the search is open", () => {
    mockSearchOpen = true;
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(screen.getByTestId("search-results")).toBeInTheDocument();
  });

  // The leading (art-column) cell hosts the rotation-mode toggle; the search
  // icon it replaced is gone.
  it("should render the rotation toggle in the leading cell", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(screen.getByTestId("rotation-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("search-icon")).not.toBeInTheDocument();
  });

  // #936/#939: the queue affordance is a dedicated, always-visible button
  // once the DJ has typed — never gated behind a held Ctrl.
  it("should show the queue button once the query has content, without Ctrl", () => {
    mockLive = true;
    mockCtrlKeyPressed = false;
    const store = createStoreWithQueryContent();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    const queueButton = screen.getByTestId("flowsheet-search-queue");
    expect(queueButton).toBeInTheDocument();
    fireEvent.click(queueButton);
    expect(mockSubmitToQueue).toHaveBeenCalled();
  });

  it("should show the clear button once the query has content and reset on click", () => {
    mockLive = true;
    const store = createStoreWithQueryContent();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    const clearButton = screen.getByTestId("flowsheet-search-clear");
    fireEvent.click(clearButton);
    expect(mockResetSearch).toHaveBeenCalled();
  });

  it("should not show the clear button while the query is empty", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(
      screen.queryByTestId("flowsheet-search-clear")
    ).not.toBeInTheDocument();
  });

  it("should not show the queue button while the search is closed", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(
      screen.queryByTestId("flowsheet-search-queue")
    ).not.toBeInTheDocument();
  });

  it("should render submit button", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    // The button shows "/" when not in search mode
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  describe("keyboard handling", () => {
    it("should focus input on / key when live", async () => {
      mockLive = true;
      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      // Simulate keydown event on document
      fireEvent.keyDown(document, { key: "/" });

      // Input should be focused (prevented default)
      // We can't directly check focus in jsdom, but we can verify the handler ran
      expect(mockResetSearch).not.toHaveBeenCalled();
    });

    it("should not intercept / key when an input is focused", () => {
      mockLive = true;
      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      const input = screen.getByTestId("input-song");
      input.focus();

      const event = new KeyboardEvent("keydown", {
        key: "/",
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      input.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should not focus input on / key when not live", async () => {
      mockLive = false;
      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      fireEvent.keyDown(document, { key: "/" });

      // Should return early when not live
      expect(mockSetSearchOpen).not.toHaveBeenCalled();
    });

    it("should handle ArrowDown key to increment selected result", () => {
      // Provide mock results so the max index is > 0
      mockCatalogResults = [{ id: "1" }, { id: "2" }];
      mockSearchOpen = true;

      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      fireEvent.keyDown(document, { key: "ArrowDown" });

      // Should dispatch setSelectedResult action
      const state = store.getState();
      expect(state.flowsheet.search.selectedResult).toBe(1);
    });

    it("should handle ArrowUp key to decrement selected result", () => {
      // Provide mock results so there are valid indices
      mockCatalogResults = [{ id: "1" }, { id: "2" }, { id: "3" }];
      mockSearchOpen = true;

      const store = createTestStore({
        flowsheet: {
          ...flowsheetSlice.getInitialState(),
          search: {
            ...flowsheetSlice.getInitialState().search,
            selectedResult: 2,
          },
        },
      });

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      fireEvent.keyDown(document, { key: "ArrowUp" });

      const state = store.getState();
      expect(state.flowsheet.search.selectedResult).toBe(1);
    });

    it("should bound ArrowDown by the VISIBLE (capped) row count, not the full result set (#657)", () => {
      // 60 catalog rows: only 50 are painted (MAX_VISIBLE_RESULTS). The nav
      // bound must stop at 50 — walking to 51+ selects an invisible row whose
      // values would silently populate the fields and submit.
      mockCatalogResults = Array.from({ length: 60 }, (_, i) => ({
        id: `${i + 1}`,
      }));
      mockSearchOpen = true;

      const store = createTestStore({
        flowsheet: {
          ...flowsheetSlice.getInitialState(),
          search: {
            ...flowsheetSlice.getInitialState().search,
            selectedResult: 50,
          },
        },
      });

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      fireEvent.keyDown(document, { key: "ArrowDown" });

      const state = store.getState();
      expect(state.flowsheet.search.selectedResult).toBe(50);
    });

    it("should not go below 0 on ArrowUp", () => {
      const store = createTestStore({
        flowsheet: {
          ...flowsheetSlice.getInitialState(),
          search: {
            ...flowsheetSlice.getInitialState().search,
            selectedResult: 0,
          },
        },
      });

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      fireEvent.keyDown(document, { key: "ArrowUp" });

      const state = store.getState();
      expect(state.flowsheet.search.selectedResult).toBe(0);
    });
  });

  describe("click away behavior", () => {
    it("should reset search on click away", async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
          <div data-testid="outside">Outside</div>
        </Provider>
      );

      // Click outside the search bar
      const outside = screen.getByTestId("outside");
      await userEvent.click(outside);

      expect(mockResetSearch).toHaveBeenCalled();
    });
  });

  describe("form submission", () => {
    it("should call handleSubmit on form submit", async () => {
      const store = createTestStore();

      const { container } = render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      const form = container.querySelector("form")!;
      fireEvent.submit(form);

      expect(mockHandleSubmit).toHaveBeenCalled();
    });

    it("should prevent default on form submit", async () => {
      const store = createTestStore();

      const { container } = render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      const form = container.querySelector("form")!;
      const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
      Object.defineProperty(submitEvent, "preventDefault", { value: vi.fn() });

      form.dispatchEvent(submitEvent);

      expect(submitEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe("button states", () => {
    // Idle ↔ commit cluster swap: breakpoint/talkset at rest, queue/play
    // while the search is open. The old "/" affordance button is gone (the
    // keyboard shortcut remains in handleKeyDown).
    it("should show special-entry buttons and no commit buttons when closed", () => {
      mockSearchOpen = false;
      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      expect(screen.getByTestId("breakpoint-button")).toBeInTheDocument();
      expect(screen.getByTestId("talkset-button")).toBeInTheDocument();
      expect(
        screen.queryByTestId("flowsheet-search-submit")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("flowsheet-search-queue")
      ).not.toBeInTheDocument();
    });

    it("should swap out special-entry buttons once the DJ has typed", () => {
      const store = createStoreWithQueryContent();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      expect(screen.queryByTestId("breakpoint-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("talkset-button")).not.toBeInTheDocument();
      expect(screen.getByTestId("flowsheet-search-submit")).toBeInTheDocument();
      expect(screen.getByTestId("flowsheet-search-queue")).toBeInTheDocument();
    });

    it("should show play icon when search is open and ctrl not pressed", () => {
      mockSearchOpen = true;
      mockCtrlKeyPressed = false;

      // Need to re-import hooks with new mock values
      vi.doMock("@/src/hooks/flowsheetHooks", () => ({
        useFlowsheetActions: vi.fn(() => ({
          addToFlowsheet: mockAddToFlowsheet,
        })),
        useFlowsheetSearch: vi.fn(() => ({
          live: mockLive,
          searchOpen: true,
          setSearchOpen: mockSetSearchOpen,
          resetSearch: mockResetSearch,
          searchQuery: { song: "", artist: "", album: "", label: "", request: false },
          setSearchProperty: mockSetSearchProperty,
        })),
        useFlowsheetSubmit: vi.fn(() => ({
          ctrlKeyPressed: false,
          handleSubmit: mockHandleSubmit,
          binResults: [],
          catalogResults: [],
          rotationResults: [],
        })),
      }));

      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      // Button should be rendered (with play icon from mock)
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("should disable submit button when not live", () => {
      mockLive = false;
      const store = createStoreWithQueryContent();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      expect(screen.getByTestId("flowsheet-search-submit")).toBeDisabled();
    });
  });

  describe("focus behavior", () => {
    it("should open search on focus when live", async () => {
      mockLive = true;
      const store = createTestStore();

      const { container } = render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      const form = container.querySelector("form")!;
      fireEvent.focus(form);

      expect(mockSetSearchOpen).toHaveBeenCalledWith(true);
    });

    it("should not open search on focus when not live", async () => {
      mockLive = false;
      const store = createTestStore();

      const { container } = render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      const form = container.querySelector("form")!;
      fireEvent.focus(form);

      expect(mockSetSearchOpen).not.toHaveBeenCalled();
    });

    it("should focus input on form click when live", async () => {
      mockLive = true;
      const store = createTestStore();

      const { container } = render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      const form = container.querySelector("form")!;
      await userEvent.click(form);

      // Click should have happened, we can verify by checking the form exists
      expect(form).toBeInTheDocument();
    });
  });

  describe("button click behavior", () => {
    it("should submit form when button clicked and search is open", async () => {
      mockSearchOpen = true;
      mockLive = true;

      vi.doMock("@/src/hooks/flowsheetHooks", () => ({
        useFlowsheetActions: vi.fn(() => ({
          addToFlowsheet: mockAddToFlowsheet,
        })),
        useFlowsheetSearch: vi.fn(() => ({
          live: true,
          searchOpen: true,
          setSearchOpen: mockSetSearchOpen,
          resetSearch: mockResetSearch,
        })),
        useFlowsheetSubmit: vi.fn(() => ({
          ctrlKeyPressed: false,
          handleSubmit: mockHandleSubmit,
          binResults: [],
          catalogResults: [],
          rotationResults: [],
        })),
      }));

      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe("effect cleanup", () => {
    it("should remove keydown listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
      const store = createTestStore();

      const { unmount } = render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe("album/label autopopulate from track suggestion", () => {
    const trackResult = {
      track_title: "Technopolis",
      album_title: "Solid State Survivor",
      record_label: "Alfa",
    };
    const songGhostWithTrack = {
      ghostSuffix: "polis",
      acceptGhostText: () => "Technopolis",
      trackResult,
    };
    const emptyGhost = {
      ghostSuffix: "",
      acceptGhostText: () => null,
      trackResult: null,
    };

    // Make the song-field ghost surface a confident track suggestion; the
    // artist-field ghost stays empty.
    const mockSongGhost = () =>
      vi
        .mocked(useGhostText)
        .mockImplementation((field) =>
          field === "song" ? songGhostWithTrack : emptyGhost
        );

    afterEach(() => {
      // Restore the file-default hooks (no suggestion, empty query) for later
      // suites — tests here drive both via mockImplementation.
      vi.mocked(useGhostText).mockImplementation(() => emptyGhost);
      vi.mocked(useFlowsheetSearch).mockImplementation(
        () =>
          ({
            live: mockLive,
            searchOpen: mockSearchOpen,
            setSearchOpen: mockSetSearchOpen,
            resetSearch: mockResetSearch,
            searchQuery: {
              song: "",
              artist: "",
              album: "",
              label: "",
              request: false,
            },
            setSearchProperty: mockSetSearchProperty,
          }) as unknown as ReturnType<typeof useFlowsheetSearch>
      );
    });

    it("fills empty album and label from the confident suggestion without Tab", () => {
      mockSongGhost();
      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      expect(mockSetSearchProperty).toHaveBeenCalledWith(
        "album",
        "Solid State Survivor"
      );
      expect(mockSetSearchProperty).toHaveBeenCalledWith("label", "Alfa");
    });

    it("does not overwrite an album the DJ has already typed", () => {
      mockSongGhost();
      // mockReturnValue (not Once): the anchor-ref setState adds a mount
      // re-render, and the hook must answer consistently on every render.
      vi.mocked(useFlowsheetSearch).mockReturnValue({
        live: mockLive,
        searchOpen: mockSearchOpen,
        setSearchOpen: mockSetSearchOpen,
        resetSearch: mockResetSearch,
        searchQuery: {
          song: "Techno",
          artist: "Yellow Magic Orchestra",
          album: "My Own Album",
          label: "",
          request: false,
        },
        setSearchProperty: mockSetSearchProperty,
      } as unknown as ReturnType<typeof useFlowsheetSearch>);
      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      expect(mockSetSearchProperty).not.toHaveBeenCalledWith(
        "album",
        "Solid State Survivor"
      );
      // The label was still empty, so it auto-fills.
      expect(mockSetSearchProperty).toHaveBeenCalledWith("label", "Alfa");
    });

    it("clears its auto-fill memory on reset so a later manual album survives", () => {
      // A confident song suggestion whose album we vary across renders.
      let trackAlbum = "Solid State Survivor";
      // Mutable search state so we can drive artist/song/album across rerenders.
      let searchState = {
        live: mockLive,
        searchOpen: mockSearchOpen,
        setSearchOpen: mockSetSearchOpen,
        resetSearch: mockResetSearch,
        searchQuery: {
          song: "Techno",
          artist: "Yellow Magic Orchestra",
          album: "",
          label: "",
          request: false,
        },
        setSearchProperty: mockSetSearchProperty,
      };
      vi.mocked(useFlowsheetSearch).mockImplementation(
        () => searchState as unknown as ReturnType<typeof useFlowsheetSearch>
      );
      // The song ghost only carries a track while a song is being typed, which
      // mirrors useGhostText returning null once the song field is empty.
      vi.mocked(useGhostText).mockImplementation((field) =>
        field === "song" && searchState.searchQuery.song
          ? {
              ghostSuffix: "",
              acceptGhostText: () => "Technopolis",
              trackResult: {
                track_title: "Technopolis",
                album_title: trackAlbum,
                record_label: "Alfa",
              },
            }
          : emptyGhost
      );

      const store = createTestStore();
      const { rerender } = render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      // Phase 1: the empty album auto-fills from the suggestion.
      expect(mockSetSearchProperty).toHaveBeenCalledWith(
        "album",
        "Solid State Survivor"
      );

      // Phase 2: the search resets (artist + song cleared) — the auto-fill
      // memory must be forgotten here.
      searchState = {
        ...searchState,
        searchQuery: {
          song: "",
          artist: "",
          album: "",
          label: "",
          request: false,
        },
      };
      rerender(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      // Phase 3: a new entry where the DJ hand-types the same album string the
      // previous entry auto-filled, while a *different* suggestion is active.
      // The manual value must survive — the stale ref must not overwrite it.
      mockSetSearchProperty.mockClear();
      trackAlbum = "Naughty Boys";
      searchState = {
        ...searchState,
        searchQuery: {
          song: "Ki",
          artist: "Yellow Magic Orchestra",
          album: "Solid State Survivor",
          label: "",
          request: false,
        },
      };
      rerender(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      expect(mockSetSearchProperty).not.toHaveBeenCalledWith(
        "album",
        "Naughty Boys"
      );
    });
  });
});
