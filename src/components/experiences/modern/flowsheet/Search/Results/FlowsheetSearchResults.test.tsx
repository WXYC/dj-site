import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import FlowsheetSearchResults from "./FlowsheetSearchResults";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock child components
vi.mock("./BackendResults/FlowsheetBackendResults", () => ({
  default: ({ results, label, offset }: any) => (
    <div data-testid="backend-results" data-label={label} data-offset={offset}>
      {results.length} results
    </div>
  ),
}));

vi.mock("./NewEntry/NewEntryPreview", () => ({
  default: () => <div data-testid="new-entry-preview">New Entry</div>,
}));

function createTestStore(searchOpen = false) {
  return configureStore({
    reducer: {
      flowsheet: flowsheetSlice.reducer,
    },
    preloadedState: {
      flowsheet: {
        ...flowsheetSlice.getInitialState(),
        searchOpen,
      },
    },
  });
}

describe("FlowsheetSearchResults", () => {
  const mockBinResults: AlbumEntry[] = [
    { id: 1, title: "Bin Album" } as AlbumEntry,
  ];
  const mockCatalogResults: AlbumEntry[] = [
    { id: 2, title: "Catalog Album" } as AlbumEntry,
  ];
  const mockRotationResults: AlbumEntry[] = [
    { id: 3, title: "Rotation Album" } as AlbumEntry,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render NewEntryPreview", () => {
    const store = createTestStore(true);

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={[]}
          catalogResults={[]}
          rotationResults={[]}
        />
      </Provider>
    );

    expect(screen.getByTestId("new-entry-preview")).toBeInTheDocument();
  });

  it("should render backend results for bin", () => {
    const store = createTestStore(true);

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={mockBinResults}
          catalogResults={[]}
          rotationResults={[]}
        />
      </Provider>
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results.some((r) => r.getAttribute("data-label") === "From Your Mail Bin")).toBe(true);
  });

  it("should render backend results for catalog", () => {
    const store = createTestStore(true);

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={[]}
          catalogResults={mockCatalogResults}
          rotationResults={[]}
        />
      </Provider>
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results.some((r) => r.getAttribute("data-label") === "From the Card Catalog")).toBe(true);
  });

  it("should render backend results for rotation", () => {
    const store = createTestStore(true);

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={[]}
          catalogResults={[]}
          rotationResults={mockRotationResults}
        />
      </Provider>
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results.some((r) => r.getAttribute("data-label") === "From Rotation")).toBe(true);
  });

  it("should render keyboard shortcut hints", () => {
    const store = createTestStore(true);

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={[]}
          catalogResults={[]}
          rotationResults={[]}
        />
      </Provider>
    );

    expect(screen.getByText("switch fields")).toBeInTheDocument();
    expect(screen.getByText("prev field")).toBeInTheDocument();
    expect(screen.getByText("prev entry")).toBeInTheDocument();
    expect(screen.getByText("next entry")).toBeInTheDocument();
    expect(screen.getByText("play")).toBeInTheDocument();
    expect(screen.getByText("queue")).toBeInTheDocument();
  });

  it("should calculate correct offsets for results", () => {
    const store = createTestStore(true);

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={mockBinResults}
          catalogResults={mockCatalogResults}
          rotationResults={mockRotationResults}
        />
      </Provider>
    );

    const results = screen.getAllByTestId("backend-results");
    // Check offsets are calculated correctly
    expect(results[0]).toHaveAttribute("data-offset", "1"); // bin
    expect(results[1]).toHaveAttribute("data-offset", "2"); // rotation (binResults.length + 1)
    expect(results[2]).toHaveAttribute("data-offset", "3"); // catalog (binResults.length + rotationResults.length + 1)
  });
});
