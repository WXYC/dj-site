import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import FlowsheetSearchResults from "@/src/components/experiences/modern/flowsheet/Search/Results/FlowsheetSearchResults";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { entryToFreezePayload } from "@/lib/features/flowsheet/conversions";
import {
  renderWithProviders,
  createTestAlbum,
  server,
  libraryTracksHandler,
  ONE_TRACK,
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

function mockLibraryTracksResponse(legacyReleaseId: number) {
  server.use(libraryTracksHandler(legacyReleaseId, ONE_TRACK));
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
    // Stubbed on the legacy id, which is what the picker requests.
    mockLibraryTracksResponse(45342);
    const linkedResult = [
      createTestAlbum({
        id: 1234,
        legacy_release_id: 45342,
        title: "Linked Library Row",
      }),
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

  // The picker read and the flowsheet write resolve in two different id
  // spaces over the same row. Reading in the wrong one almost never misses —
  // the spaces are nearly coextensive — so it returns a real but unrelated
  // release's tracklist, presented as this release's, with a 200 and nothing
  // in telemetry. These cases pin the read to the space the endpoint actually
  // resolves in.
  describe("id space the picker resolves in", () => {
    // Two live handlers, one per id space, returning distinguishable
    // tracklists. Asserting on WHICH tracklist arrives is what makes a
    // wrong-space read visible; stubbing only the correct id would let a
    // wrong-space read fail as an unstubbed request, which reads as a
    // collapsed picker rather than a wrong answer.
    const LIBRARY_ID = 1234;
    const LEGACY_RELEASE_ID = 45342;

    const stubBothSpaces = () => {
      server.use(
        libraryTracksHandler(LIBRARY_ID, [
          {
            position: "B2",
            title: "WRONG RELEASE — resolved in the library.id space",
            artist_credit: "Not This Artist",
          },
        ]),
        libraryTracksHandler(LEGACY_RELEASE_ID, ONE_TRACK),
      );
    };

    const highlightedRow = [
      createTestAlbum({
        id: LIBRARY_ID,
        legacy_release_id: LEGACY_RELEASE_ID,
        title: "Linked Library Row",
      }),
    ];

    it("fetches the highlighted row's legacy_release_id, not its library.id", async () => {
      stubBothSpaces();

      renderWithProviders(
        <FlowsheetSearchResults
          binResults={highlightedRow}
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

      await screen.findByTestId("library-track-picker-manual");

      const tracks =
        libraryTrackPickerSpy.mock.calls.at(-1)?.[0]?.tracks ?? [];
      expect(tracks).toHaveLength(1);
      expect(tracks[0].title).toBe("la paradoja");
    });

    it("keeps resolving on the legacy id after a click clears the highlight", async () => {
      // The dominant flow is click the release, then pick the track — and the
      // click zeroes selectedResult, so there is no highlighted row left to
      // read. The frozen query has to carry the legacy id itself; carrying
      // only album_id would send the picker back into the library.id space
      // for the whole post-click interaction.
      stubBothSpaces();

      const { store } = renderWithProviders(
        <FlowsheetSearchResults
          binResults={highlightedRow}
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
                selectedResult: 0,
                confirmedArtist: "",
                resetEpoch: 0,
              },
            }),
          },
        }
      );

      store.dispatch(
        flowsheetSlice.actions.freezeSelectionToQuery({
          artist: "Juana Molina",
          album: "DOGA",
          label: "Sonamos",
          artistProvided: true,
          album_id: LIBRARY_ID,
          legacy_release_id: LEGACY_RELEASE_ID,
        })
      );

      await screen.findByTestId("library-track-picker-manual");

      const tracks =
        libraryTrackPickerSpy.mock.calls.at(-1)?.[0]?.tracks ?? [];
      expect(tracks).toHaveLength(1);
      expect(tracks[0].title).toBe("la paradoja");
    });

    it("keeps the picker offered when the write-gate withheld album_id from an LML freeze", async () => {
      // The gated-LML shape: entryToFreezePayload withholds album_id for
      // lml_source rows, so the frozen query carries only the read half.
      // The picker must stay offered — the pick submits freeform, with its
      // track_position tied to the legacy id it was read from.
      stubBothSpaces();

      const { store } = renderWithProviders(
        <FlowsheetSearchResults
          binResults={[]}
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
                selectedResult: 0,
                confirmedArtist: "",
                resetEpoch: 0,
              },
            }),
          },
        }
      );

      store.dispatch(
        flowsheetSlice.actions.freezeSelectionToQuery(
          entryToFreezePayload({
            id: LEGACY_RELEASE_ID,
            legacy_release_id: LEGACY_RELEASE_ID,
            lml_source: true,
            artist: { name: "Juana Molina" },
            title: "DOGA",
            label: "Sonamos",
          })
        )
      );

      expect(store.getState().flowsheet.search.query.album_id).toBeUndefined();

      await screen.findByTestId("flowsheet-search-track-picker-row");
      await screen.findByTestId("library-track-picker-manual");
      const tracks =
        libraryTrackPickerSpy.mock.calls.at(-1)?.[0]?.tracks ?? [];
      expect(tracks).toHaveLength(1);
      expect(tracks[0].title).toBe("la paradoja");
    });

    it("offers no picker for a row with a library link but no legacy id", async () => {
      // Backend's column is NOT NULL, so this is an emitter that predates the
      // field, not routine data. It must collapse to free text rather than
      // fall back to the library.id space.
      stubBothSpaces();

      renderWithProviders(
        <FlowsheetSearchResults
          binResults={[
            createTestAlbum({
              id: LIBRARY_ID,
              legacy_release_id: null,
              title: "No Legacy Id",
            }),
          ]}
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

      // The picker ROW still renders — the row is library-linked, so a track
      // is still offerable as free text — but the dropdown never populates.
      expect(
        screen.getByTestId("flowsheet-search-track-picker-row")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("library-track-picker-manual")
      ).not.toBeInTheDocument();
    });

    // The two ids answer two different questions, but they must answer them
    // about the SAME row. A frozen release outlives the highlight that created
    // it, so resolving each id independently lets one side reach past the
    // highlighted row into the frozen query — and a picker that straddles two
    // releases pairs one release's track position with the other's album_id.
    // Both cases below arrive through the ordinary sequence: click a release,
    // then arrow onto another row.
    const freezeReleaseA = (store: ReturnType<typeof renderWithProviders>["store"]) =>
      store.dispatch(
        flowsheetSlice.actions.freezeSelectionToQuery({
          artist: "Juana Molina",
          album: "DOGA",
          label: "Sonamos",
          artistProvided: true,
          album_id: LIBRARY_ID,
          legacy_release_id: LEGACY_RELEASE_ID,
        })
      );

    it("drops the frozen release's tracklist when the highlight moves to a row with no legacy id", async () => {
      stubBothSpaces();

      const { store } = renderWithProviders(
        <FlowsheetSearchResults
          binResults={[
            createTestAlbum({
              id: 5678,
              legacy_release_id: null,
              title: "No Legacy Id",
            }),
          ]}
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
                selectedResult: 0,
                confirmedArtist: "",
                resetEpoch: 0,
              },
            }),
          },
        }
      );

      // Settle on the frozen release first, so the collapse below is the
      // highlight taking effect rather than the query never having resolved.
      freezeReleaseA(store);
      await screen.findByTestId("library-track-picker-manual");

      store.dispatch(flowsheetSlice.actions.setSelectedResult(1));

      await waitFor(() =>
        expect(
          screen.queryByTestId("library-track-picker-manual")
        ).not.toBeInTheDocument()
      );
      // Still library-linked, so free text is still offerable.
      expect(
        screen.getByTestId("flowsheet-search-track-picker-row")
      ).toBeInTheDocument();
    });

    it("withdraws the picker when the highlight moves to a library-unlinked row", async () => {
      // Unlinked rows carry a client-synthesized negative id and no legacy id,
      // so neither question has an answer. Falling back to the frozen release
      // for either one offers a picker whose pick the submission boundary
      // discards for want of a positive album_id.
      stubBothSpaces();

      const { store } = renderWithProviders(
        <FlowsheetSearchResults
          binResults={[]}
          catalogResults={[]}
          rotationResults={[
            createTestAlbum({
              id: -8812,
              legacy_release_id: null,
              title: "Unlinked Rotation Row",
            }),
          ]}
          lmlResults={[]}
        />,
        {
          preloadedState: {
            flowsheet: buildFlowsheetState(true, {
              search: {
                open: true,
                query: flowsheetSlice.getInitialState().search.query,
                selectedResult: 0,
                confirmedArtist: "",
                resetEpoch: 0,
              },
            }),
          },
        }
      );

      freezeReleaseA(store);
      await screen.findByTestId("library-track-picker-manual");

      store.dispatch(flowsheetSlice.actions.setSelectedResult(1));

      await waitFor(() =>
        expect(
          screen.queryByTestId("flowsheet-search-track-picker-row")
        ).not.toBeInTheDocument()
      );
    });

    it("fetches no tracklist while rotation mode holds a legacy id in the query", async () => {
      // Rotation mode writes the pair into the query but offers no picker row,
      // so the tracklist has no consumer there. The request is the only
      // observable difference, hence the counter.
      stubBothSpaces();

      const trackRequests: string[] = [];
      const record = ({ request }: { request: Request }) => {
        if (new URL(request.url).pathname.endsWith("/tracks")) {
          trackRequests.push(request.url);
        }
      };
      server.events.on("request:start", record);

      try {
        const rotation = renderWithProviders(
          <FlowsheetSearchResults
            binResults={[]}
            catalogResults={[]}
            rotationResults={[]}
            lmlResults={[]}
          />,
          {
            preloadedState: {
              flowsheet: buildFlowsheetState(true, {
                rotationMode: true,
                search: {
                  open: true,
                  query: flowsheetSlice.getInitialState().search.query,
                  selectedResult: 0,
                  confirmedArtist: "",
                  resetEpoch: 0,
                },
              }),
            },
          }
        );

        freezeReleaseA(rotation.store);
        await new Promise((r) => setTimeout(r, 20));
        expect(trackRequests).toHaveLength(0);
        rotation.unmount();

        // The same query state outside rotation mode DOES fetch — without this
        // half, a component that never fetches at all would pass the above.
        const normal = renderWithProviders(
          <FlowsheetSearchResults
            binResults={[]}
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
                  selectedResult: 0,
                  confirmedArtist: "",
                  resetEpoch: 0,
                },
              }),
            },
          }
        );

        freezeReleaseA(normal.store);
        await screen.findByTestId("library-track-picker-manual");
        expect(trackRequests).toHaveLength(1);
      } finally {
        server.events.removeListener("request:start", record);
      }
    });
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
