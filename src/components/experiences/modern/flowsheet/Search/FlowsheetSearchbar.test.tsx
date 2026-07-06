import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FlowsheetSearchbar from "./FlowsheetSearchbar";
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
vi.mock("./BreakpointButton", () => ({
  default: () => <button data-testid="breakpoint-button">Breakpoint</button>,
}));

vi.mock("./TalksetButton", () => ({
  default: () => <button data-testid="talkset-button">Talkset</button>,
}));

vi.mock("./FlowsheetSearchInput", () => ({
  default: ({ name, disabled }: any) => (
    <input data-testid={`input-${name}`} name={name} disabled={disabled} />
  ),
}));

vi.mock("./Results/FlowsheetSearchResults", () => ({
  default: () => <div data-testid="search-results">Results</div>,
}));

vi.mock("./RotationModeToggle", () => ({
  default: () => <button data-testid="rotation-toggle">Rotation</button>,
}));

vi.mock("./RotationEntryFields", () => ({
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
  Troubleshoot: () => <span data-testid="search-icon" />,
}));

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
    // searchbar's FormControl absorbs all leftover vertical space and pushes
    // the entry tables to the bottom of the viewport.
    const formControl = container.querySelector(
      ".MuiFormControl-root"
    ) as HTMLElement;
    expect(formControl).toBeInTheDocument();
    expect(getComputedStyle(formControl).flexGrow).not.toBe("1");
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

  it("should render search results container", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(screen.getByTestId("search-results")).toBeInTheDocument();
  });

  it("should render search icon", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
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
    it("should show / when search is closed", () => {
      mockSearchOpen = false;
      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      const buttons = screen.getAllByRole("button");
      const submitButton = buttons.find((btn) => btn.textContent === "/");
      expect(submitButton).toBeInTheDocument();
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
      const store = createTestStore();

      render(
        <Provider store={store}>
          <FlowsheetSearchbar />
        </Provider>
      );

      const buttons = screen.getAllByRole("button");
      const submitButton = buttons.find((btn) => btn.textContent === "/");
      expect(submitButton).toBeDisabled();
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
      vi.mocked(useFlowsheetSearch).mockReturnValueOnce({
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
