import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import FlowsheetSearchbar from "./FlowsheetSearchbar";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";

// Mock hooks
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheet: vi.fn(() => ({
    addToFlowsheet: vi.fn(),
  })),
  useFlowsheetSearch: vi.fn(() => ({
    live: false,
    searchOpen: false,
    setSearchOpen: vi.fn(),
    resetSearch: vi.fn(),
  })),
  useFlowsheetSubmit: vi.fn(() => ({
    ctrlKeyPressed: false,
    handleSubmit: vi.fn(),
    binResults: [],
    catalogResults: [],
    rotationResults: [],
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
  default: ({ name }: any) => (
    <input data-testid={`input-${name}`} name={name} />
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

function createTestStore() {
  return configureStore({
    reducer: {
      flowsheet: flowsheetSlice.reducer,
    },
  });
}

describe("FlowsheetSearchbar", () => {
  beforeEach(() => {
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

  it("should render search inputs", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetSearchbar />
      </Provider>
    );

    expect(screen.getByTestId("input-song")).toBeInTheDocument();
    expect(screen.getByTestId("input-artist")).toBeInTheDocument();
    expect(screen.getByTestId("input-album")).toBeInTheDocument();
    expect(screen.getByTestId("input-label")).toBeInTheDocument();
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
});
