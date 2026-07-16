import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlowsheetSearchResults from "@/src/components/experiences/modern/flowsheet/Search/Results/FlowsheetSearchResults";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock child components
vi.mock("@/src/components/experiences/modern/flowsheet/Search/Results/BackendResults/FlowsheetBackendResults", () => ({
  // Keep in sync with the real per-section cap — the offsets under test are
  // derived from it. (#657)
  MAX_VISIBLE_RESULTS: 50,
  default: ({ results, label, offset }: any) => (
    <div data-testid="backend-results" data-label={label} data-offset={offset}>
      {results.length} results
    </div>
  ),
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Search/Results/NewEntry/NewEntryPreview", () => ({
  default: () => <div data-testid="new-entry-preview">New Entry</div>,
}));

// LibraryTrackPicker hits the proxy `/library/:id/tracks` endpoint via
// metadataApi; we don't want this test to wire that into the store. The
// default stub returns `show: true` so the picker row is rendered when its
// other guards pass — individual tests override useLibraryTrackPicker as
// needed.
const libraryTrackPickerSpy = vi.fn();
vi.mock("@/src/components/experiences/modern/flowsheet/Search/LibraryTrackPicker", () => ({
  __esModule: true,
  default: (props: any) => {
    libraryTrackPickerSpy(props);
    return (
      <button
        data-testid="library-track-picker-manual"
        onClick={() => props.onManualEntry?.()}
      >
        Not listed
      </button>
    );
  },
  useLibraryTrackPicker: () => ({ show: true, isLoading: false, tracks: [] }),
}));

function createTestStore(
  searchOpen = false,
  overrides: Partial<ReturnType<typeof flowsheetSlice.getInitialState>> = {}
) {
  const initial = flowsheetSlice.getInitialState();
  return configureStore({
    reducer: {
      flowsheet: flowsheetSlice.reducer,
    },
    preloadedState: {
      flowsheet: {
        ...initial,
        ...overrides,
        search: {
          ...initial.search,
          ...(overrides.search ?? {}),
          open: searchOpen,
        },
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
          lmlResults={[]}
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
          lmlResults={[]}
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
          lmlResults={[]}
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
          lmlResults={[]}
        />
      </Provider>
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results.some((r) => r.getAttribute("data-label") === "From Rotation")).toBe(true);
  });

  it("should render backend results for LML library search", () => {
    const store = createTestStore(true);
    const mockLmlResults: AlbumEntry[] = [
      { id: 4, title: "LML Album" } as AlbumEntry,
    ];

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={[]}
          catalogResults={[]}
          rotationResults={[]}
          lmlResults={mockLmlResults}
        />
      </Provider>
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results.some((r) => r.getAttribute("data-label") === "From Library Search")).toBe(true);
  });

  it("should render keyboard shortcut hints", () => {
    const store = createTestStore(true);

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={[]}
          catalogResults={[]}
          rotationResults={[]}
          lmlResults={[]}
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

  // dj-site#704: a library-unlinked rotation row carries a synthesized
  // negative AlbumEntry.id (from synthesizeAlbumId). The picker over such a
  // row would let the DJ pick "A1" via setTrackPosition, which #702's
  // chokepoint then silently drops on submit (no positive album_id to anchor
  // it). Hide the picker entirely instead — the freeform variant has no
  // track_position field anyway.
  describe("LibraryTrackPicker visibility over unlinked rotation rows", () => {
    it("hides the picker row when the highlighted result has a synthesized negative id", () => {
      const store = createTestStore(true, {
        search: {
          open: true,
          query: flowsheetSlice.getInitialState().search.query,
          selectedResult: 1,
          confirmedArtist: "",
        },
      });
      const unlinkedRotationResult: AlbumEntry[] = [
        { id: -987654, title: "Unlinked Rotation Row" } as AlbumEntry,
      ];

      render(
        <Provider store={store}>
          <FlowsheetSearchResults
            binResults={unlinkedRotationResult}
            catalogResults={[]}
            rotationResults={[]}
            lmlResults={[]}
          />
        </Provider>
      );

      expect(
        screen.queryByTestId("flowsheet-search-track-picker-row")
      ).not.toBeInTheDocument();
    });

    it("shows the picker row when the highlighted result has a positive library.id", () => {
      const store = createTestStore(true, {
        search: {
          open: true,
          query: flowsheetSlice.getInitialState().search.query,
          selectedResult: 1,
          confirmedArtist: "",
        },
      });
      const linkedResult: AlbumEntry[] = [
        { id: 1234, title: "Linked Library Row" } as AlbumEntry,
      ];

      render(
        <Provider store={store}>
          <FlowsheetSearchResults
            binResults={linkedResult}
            catalogResults={[]}
            rotationResults={[]}
            lmlResults={[]}
          />
        </Provider>
      );

      expect(
        screen.getByTestId("flowsheet-search-track-picker-row")
      ).toBeInTheDocument();
    });
  });

  // dj-site#704: clicking "Not listed" must clear any track_position the DJ
  // previously picked, otherwise a stale "A1" rides through on submit
  // pointing at an album the DJ no longer intends.
  it("clears track_position in Redux when the manual-entry button is clicked", () => {
    const store = createTestStore(true, {
      search: {
        open: true,
        query: {
          ...flowsheetSlice.getInitialState().search.query,
          track_position: "A1",
        },
        selectedResult: 1,
        confirmedArtist: "",
      },
    });
    const linkedResult: AlbumEntry[] = [
      { id: 1234, title: "Linked Library Row" } as AlbumEntry,
    ];

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={linkedResult}
          catalogResults={[]}
          rotationResults={[]}
          lmlResults={[]}
        />
      </Provider>
    );

    fireEvent.click(screen.getByTestId("library-track-picker-manual"));

    expect(store.getState().flowsheet.search.query.track_position).toBeUndefined();
  });

  it("should calculate correct offsets for results", () => {
    const store = createTestStore(true);
    const mockLmlResults: AlbumEntry[] = [
      { id: 4, title: "LML Album" } as AlbumEntry,
    ];

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={mockBinResults}
          catalogResults={mockCatalogResults}
          rotationResults={mockRotationResults}
          lmlResults={mockLmlResults}
        />
      </Provider>
    );

    const results = screen.getAllByTestId("backend-results");
    // Check offsets are calculated correctly
    expect(results[0]).toHaveAttribute("data-offset", "1"); // bin
    expect(results[1]).toHaveAttribute("data-offset", "2"); // rotation (binResults.length + 1)
    expect(results[2]).toHaveAttribute("data-offset", "3"); // catalog (binResults.length + rotationResults.length + 1)
    expect(results[3]).toHaveAttribute("data-offset", "4"); // lml (bin + rotation + catalog + 1)
  });

  it("should derive offsets from the CAPPED section lengths when a section is truncated (#657)", () => {
    const store = createTestStore(true);
    // 60 bin rows: only 50 are painted, so later sections must start at 51 —
    // full-length offsets would desync the highlight from the visible rows.
    const manyBinResults: AlbumEntry[] = Array.from(
      { length: 60 },
      (_, i) => ({ id: 100 + i, title: `Bin Album ${i}` } as AlbumEntry)
    );
    const mockLmlResults: AlbumEntry[] = [
      { id: 4, title: "LML Album" } as AlbumEntry,
    ];

    render(
      <Provider store={store}>
        <FlowsheetSearchResults
          binResults={manyBinResults}
          catalogResults={mockCatalogResults}
          rotationResults={mockRotationResults}
          lmlResults={mockLmlResults}
        />
      </Provider>
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results[0]).toHaveAttribute("data-offset", "1"); // bin
    expect(results[1]).toHaveAttribute("data-offset", "51"); // rotation (min(60, 50) + 1)
    expect(results[2]).toHaveAttribute("data-offset", "52"); // catalog
    expect(results[3]).toHaveAttribute("data-offset", "53"); // lml
  });
});
