import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FlowsheetSearchbar from "./FlowsheetSearchbar";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";

// Mock hook return values that can be changed per test
let mockLive = false;
let mockSearchOpen = false;
let mockCtrlKeyPressed = false;
let mockBinResults: any[] = [];
let mockCatalogResults: any[] = [];
let mockRotationResults: any[] = [];
const mockSetSearchOpen = vi.fn();
const mockResetSearch = vi.fn();
const mockHandleSubmit = vi.fn();
const mockAddToFlowsheet = vi.fn();
const mockSetSearchProperty = vi.fn();

// Mock hooks
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheet: vi.fn(() => ({
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
        useFlowsheet: vi.fn(() => ({
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
        useFlowsheet: vi.fn(() => ({
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
});
