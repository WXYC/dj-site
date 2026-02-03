import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlowsheetBackendResult from "./FlowsheetBackendResult";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock hooks
const mockHandleSubmit = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSubmit: vi.fn(() => ({
    ctrlKeyPressed: false,
    handleSubmit: mockHandleSubmit,
  })),
}));

// Mock ArtistAvatar
vi.mock("@/src/components/experiences/modern/catalog/ArtistAvatar", () => ({
  ArtistAvatar: ({ artist }: any) => (
    <div data-testid="artist-avatar">{artist?.name}</div>
  ),
}));

function createTestStore(selectedResult = 0) {
  return configureStore({
    reducer: {
      flowsheet: flowsheetSlice.reducer,
    },
    preloadedState: {
      flowsheet: {
        ...flowsheetSlice.getInitialState(),
        selectedResult,
      },
    },
  });
}

describe("FlowsheetBackendResult", () => {
  const mockEntry: AlbumEntry = {
    id: 1,
    title: "Test Album",
    entry: 5,
    format: "CD",
    label: "Test Label",
    play_freq: "high",
    artist: {
      id: 1,
      name: "Test Artist",
      lettercode: "TA",
      numbercode: 100,
      genre: "Rock",
    },
  } as AlbumEntry;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render artist avatar", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetBackendResult entry={mockEntry} index={1} />
      </Provider>
    );

    expect(screen.getByTestId("artist-avatar")).toBeInTheDocument();
  });

  it("should render artist name", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetBackendResult entry={mockEntry} index={1} />
      </Provider>
    );

    const artists = screen.getAllByText("Test Artist");
    expect(artists.length).toBeGreaterThan(0);
  });

  it("should render album title", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetBackendResult entry={mockEntry} index={1} />
      </Provider>
    );

    expect(screen.getByText("Test Album")).toBeInTheDocument();
  });

  it("should render label", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetBackendResult entry={mockEntry} index={1} />
      </Provider>
    );

    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("should render field labels", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetBackendResult entry={mockEntry} index={1} />
      </Provider>
    );

    expect(screen.getByText("CODE")).toBeInTheDocument();
    expect(screen.getByText("ARTIST")).toBeInTheDocument();
    expect(screen.getByText("ALBUM")).toBeInTheDocument();
    expect(screen.getByText("LABEL")).toBeInTheDocument();
  });

  it("should render format chip", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetBackendResult entry={mockEntry} index={1} />
      </Provider>
    );

    expect(screen.getByText("cd")).toBeInTheDocument();
  });

  it("should render vinyl chip for vinyl format", () => {
    const vinylEntry = { ...mockEntry, format: "vinyl 12" };
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetBackendResult entry={vinylEntry} index={1} />
      </Provider>
    );

    expect(screen.getByText("vinyl")).toBeInTheDocument();
  });

  it("should render without throwing", () => {
    const store = createTestStore();

    expect(() => {
      render(
        <Provider store={store}>
          <FlowsheetBackendResult entry={mockEntry} index={1} />
        </Provider>
      );
    }).not.toThrow();
  });

  it("should render code information", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <FlowsheetBackendResult entry={mockEntry} index={1} />
      </Provider>
    );

    // Should show genre, lettercode, numbercode
    expect(screen.getByText(/Rock TA 100/)).toBeInTheDocument();
  });
});
