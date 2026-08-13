import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import FlowsheetSearchResults from "@/src/components/experiences/modern/flowsheet/Search/Results/FlowsheetSearchResults";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  renderWithProviders,
  createTestAlbum,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import type { RootState } from "@/lib/store";

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

// Only the presentational component is mocked, so the "not listed" wiring
// stays assertable without driving the real combobox — useLibraryTrackPicker
// is left real. The manual-entry button only renders once its tracks query
// resolves, so exercising it needs the real hook plus a resolved tracklist.
const libraryTrackPickerSpy = vi.fn();
vi.mock("@/src/components/experiences/modern/flowsheet/Search/LibraryTrackPicker", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/src/components/experiences/modern/flowsheet/Search/LibraryTrackPicker")
  >();
  return {
    ...actual,
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
  };
});

function mockLibraryTracksResponse(libraryId: number) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/proxy/library/${libraryId}/tracks`, () =>
      HttpResponse.json({
        library_id: libraryId,
        discogs_release_id: 42,
        source: "discogs",
        tracks: [
          {
            position: "A1",
            title: "la paradoja",
            artist_credit: "Juana Molina",
            duration_ms: null,
          },
        ],
      })
    )
  );
}

function buildFlowsheetState(
  searchOpen = false,
  overrides: Partial<ReturnType<typeof flowsheetSlice.getInitialState>> = {}
): RootState["flowsheet"] {
  const initial = flowsheetSlice.getInitialState();
  return {
    ...initial,
    ...overrides,
    search: {
      ...initial.search,
      ...(overrides.search ?? {}),
      open: searchOpen,
    },
  };
}

describe("FlowsheetSearchResults", () => {
  const mockBinResults = [createTestAlbum({ id: 1, title: "Bin Album" })];
  const mockCatalogResults = [
    createTestAlbum({ id: 2, title: "Catalog Album" }),
  ];
  const mockRotationResults = [
    createTestAlbum({ id: 3, title: "Rotation Album" }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render backend results for bin", () => {
    renderWithProviders(
      <FlowsheetSearchResults
        binResults={mockBinResults}
        catalogResults={[]}
        rotationResults={[]}
        lmlResults={[]}
      />,
      { preloadedState: { flowsheet: buildFlowsheetState(true) } }
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results.some((r) => r.getAttribute("data-label") === "From Your Mail Bin")).toBe(true);
  });

  it("should render backend results for catalog", () => {
    renderWithProviders(
      <FlowsheetSearchResults
        binResults={[]}
        catalogResults={mockCatalogResults}
        rotationResults={[]}
        lmlResults={[]}
      />,
      { preloadedState: { flowsheet: buildFlowsheetState(true) } }
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results.some((r) => r.getAttribute("data-label") === "From the Card Catalog")).toBe(true);
  });

  it("should render backend results for rotation", () => {
    renderWithProviders(
      <FlowsheetSearchResults
        binResults={[]}
        catalogResults={[]}
        rotationResults={mockRotationResults}
        lmlResults={[]}
      />,
      { preloadedState: { flowsheet: buildFlowsheetState(true) } }
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results.some((r) => r.getAttribute("data-label") === "From Rotation")).toBe(true);
  });

  it("should render backend results for LML library search", () => {
    const mockLmlResults = [createTestAlbum({ id: 4, title: "LML Album" })];

    renderWithProviders(
      <FlowsheetSearchResults
        binResults={[]}
        catalogResults={[]}
        rotationResults={[]}
        lmlResults={mockLmlResults}
      />,
      { preloadedState: { flowsheet: buildFlowsheetState(true) } }
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results.some((r) => r.getAttribute("data-label") === "From Library Search")).toBe(true);
  });

  it("should render keyboard shortcut hints", () => {
    renderWithProviders(
      <FlowsheetSearchResults
        binResults={[]}
        catalogResults={[]}
        rotationResults={[]}
        lmlResults={[]}
      />,
      { preloadedState: { flowsheet: buildFlowsheetState(true) } }
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
      const unlinkedRotationResult = [
        createTestAlbum({ id: -987654, title: "Unlinked Rotation Row" }),
      ];

      renderWithProviders(
        <FlowsheetSearchResults
          binResults={unlinkedRotationResult}
          catalogResults={[]}
          rotationResults={[]}
          lmlResults={[]}
        />,
        {
          preloadedState: {
            flowsheet: buildFlowsheetState(true, {
              search: {
                open: true,
                query: flowsheetSlice.getInitialState().search.query,
                selectedResult: 1,
                confirmedArtist: "",
                resetEpoch: 0,
              },
            }),
          },
        }
      );

      expect(
        screen.queryByTestId("flowsheet-search-track-picker-row")
      ).not.toBeInTheDocument();
    });

    it("shows the picker row when the highlighted result has a positive library.id", () => {
      const linkedResult = [
        createTestAlbum({ id: 1234, title: "Linked Library Row" }),
      ];

      renderWithProviders(
        <FlowsheetSearchResults
          binResults={linkedResult}
          catalogResults={[]}
          rotationResults={[]}
          lmlResults={[]}
        />,
        {
          preloadedState: {
            flowsheet: buildFlowsheetState(true, {
              search: {
                open: true,
                query: flowsheetSlice.getInitialState().search.query,
                selectedResult: 1,
                confirmedArtist: "",
                resetEpoch: 0,
              },
            }),
          },
        }
      );

      expect(
        screen.getByTestId("flowsheet-search-track-picker-row")
      ).toBeInTheDocument();
    });
  });

  // dj-site#704: clicking "Not listed" must clear any track_position the DJ
  // previously picked, otherwise a stale "A1" rides through on submit
  // pointing at an album the DJ no longer intends.
  it("clears track_position in Redux when the manual-entry button is clicked", async () => {
    mockLibraryTracksResponse(1234);
    const linkedResult = [
      createTestAlbum({ id: 1234, title: "Linked Library Row" }),
    ];

    const { store } = renderWithProviders(
      <FlowsheetSearchResults
        binResults={linkedResult}
        catalogResults={[]}
        rotationResults={[]}
        lmlResults={[]}
      />,
      {
        preloadedState: {
          flowsheet: buildFlowsheetState(true, {
            search: {
              open: true,
              query: {
                ...flowsheetSlice.getInitialState().search.query,
                track_position: "A1",
              },
              selectedResult: 1,
              confirmedArtist: "",
              resetEpoch: 0,
            },
          }),
        },
      }
    );

    fireEvent.click(await screen.findByTestId("library-track-picker-manual"));

    expect(store.getState().flowsheet.search.query.track_position).toBeUndefined();
  });

  it("should calculate correct offsets for results", () => {
    const mockLmlResults = [createTestAlbum({ id: 4, title: "LML Album" })];

    renderWithProviders(
      <FlowsheetSearchResults
        binResults={mockBinResults}
        catalogResults={mockCatalogResults}
        rotationResults={mockRotationResults}
        lmlResults={mockLmlResults}
      />,
      { preloadedState: { flowsheet: buildFlowsheetState(true) } }
    );

    const results = screen.getAllByTestId("backend-results");
    // Check offsets are calculated correctly
    expect(results[0]).toHaveAttribute("data-offset", "1"); // bin
    expect(results[1]).toHaveAttribute("data-offset", "2"); // rotation (binResults.length + 1)
    expect(results[2]).toHaveAttribute("data-offset", "3"); // catalog (binResults.length + rotationResults.length + 1)
    expect(results[3]).toHaveAttribute("data-offset", "4"); // lml (bin + rotation + catalog + 1)
  });

  it("should derive offsets from the CAPPED section lengths when a section is truncated (#657)", () => {
    // 60 bin rows: only 50 are painted, so later sections must start at 51 —
    // full-length offsets would desync the highlight from the visible rows.
    const manyBinResults = Array.from({ length: 60 }, (_, i) =>
      createTestAlbum({ id: 100 + i, title: `Bin Album ${i}` })
    );
    const mockLmlResults = [createTestAlbum({ id: 4, title: "LML Album" })];

    renderWithProviders(
      <FlowsheetSearchResults
        binResults={manyBinResults}
        catalogResults={mockCatalogResults}
        rotationResults={mockRotationResults}
        lmlResults={mockLmlResults}
      />,
      { preloadedState: { flowsheet: buildFlowsheetState(true) } }
    );

    const results = screen.getAllByTestId("backend-results");
    expect(results[0]).toHaveAttribute("data-offset", "1"); // bin
    expect(results[1]).toHaveAttribute("data-offset", "51"); // rotation (min(60, 50) + 1)
    expect(results[2]).toHaveAttribute("data-offset", "52"); // catalog
    expect(results[3]).toHaveAttribute("data-offset", "53"); // lml
  });
});
