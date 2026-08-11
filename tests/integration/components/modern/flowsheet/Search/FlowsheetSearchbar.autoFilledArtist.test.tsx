import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestStore,
  createTestAlbum,
  createTestArtist,
} from "@/tests/helpers";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { seedableArtistName } from "@/lib/features/flowsheet/various-artists-guard";
import FlowsheetSearchbar from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchbar";
import {
  useFlowsheetSearch,
  useFlowsheetSubmit,
} from "@/src/hooks/flowsheetHooks";
import { useGhostText } from "@/src/hooks/useGhostText";

// useFlowsheetSearch/useFlowsheetSubmit fan out into RTK Query hooks for bin/
// catalog/rotation/LML search. Mocked here so the test doesn't need MSW
// handlers for the full search surface — real Redux still drives
// selectedResult (dispatched below), and FlowsheetSearchInput dispatches
// straight to the real store, which is what the ghost-text suppression under
// test actually depends on.
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: vi.fn(),
  useFlowsheetSubmit: vi.fn(),
}));

vi.mock("@/src/hooks/useGhostText", () => ({
  useGhostText: vi.fn(),
}));

vi.mock(
  "@/src/components/experiences/modern/flowsheet/Search/BreakpointButton",
  () => ({
    default: () => <button data-testid="breakpoint-button">Breakpoint</button>,
  })
);
vi.mock(
  "@/src/components/experiences/modern/flowsheet/Search/TalksetButton",
  () => ({
    default: () => <button data-testid="talkset-button">Talkset</button>,
  })
);
vi.mock(
  "@/src/components/experiences/modern/flowsheet/Search/Results/FlowsheetSearchResults",
  () => ({
    default: () => <div data-testid="search-results">Results</div>,
  })
);
vi.mock(
  "@/src/components/experiences/modern/flowsheet/Search/RotationModeToggle",
  () => ({
    default: () => <button data-testid="rotation-toggle">Rotation</button>,
  })
);
vi.mock(
  "@/src/components/experiences/modern/flowsheet/Search/RotationEntryFields",
  () => ({
    default: () => <div data-testid="rotation-entry-fields" />,
  })
);
vi.mock("@mui/icons-material", () => ({
  PlayArrow: () => <span data-testid="play-icon" />,
  QueueMusic: () => <span data-testid="queue-icon" />,
  Close: () => <span data-testid="close-icon" />,
}));

// A highlighted (arrow-keyed, not yet clicked) search result. FlowsheetSearchInput
// is left un-mocked so ghost-text rendering reflects the real isAutoFilled
// wiring in FlowsheetSearchbar rather than a mock's assumption about it.
function renderWithHighlightedEntry(
  selectedEntry: ReturnType<typeof createTestAlbum>
) {
  const store = createTestStore();
  store.dispatch(flowsheetSlice.actions.setSelectedResult(1));

  vi.mocked(useFlowsheetSubmit).mockReturnValue({
    ctrlKeyPressed: false,
    handleSubmit: vi.fn(),
    submitToQueue: vi.fn(),
    binResults: [],
    catalogResults: [],
    rotationResults: [],
    lmlResults: [],
    selectedEntry,
  } as unknown as ReturnType<typeof useFlowsheetSubmit>);

  vi.mocked(useFlowsheetSearch).mockReturnValue({
    live: true,
    searchOpen: true,
    setSearchOpen: vi.fn(),
    resetSearch: vi.fn(),
    searchQuery: { song: "", artist: "", album: "", label: "", request: false },
    setSearchProperty: vi.fn(),
    // Mirrors the real hook: a refused credit is withheld from the field,
    // same as the highlighted release it previews.
    getDisplayValue: (name: string) =>
      name === "artist" ? seedableArtistName(selectedEntry) : "",
  } as unknown as ReturnType<typeof useFlowsheetSearch>);

  vi.mocked(useGhostText).mockImplementation((field) =>
    field === "artist"
      ? {
          ghostSuffix: "essica Pratt",
          acceptGhostText: () => null,
          trackResult: null,
        }
      : { ghostSuffix: "", acceptGhostText: () => null, trackResult: null }
  );

  return renderWithProviders(<FlowsheetSearchbar />, { store });
}

describe("FlowsheetSearchbar artist ghost text while a result is highlighted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps artist typeahead working when the highlighted release's credit is refused", () => {
    const compilation = createTestAlbum({
      id: 501,
      title: "Edits",
      artist: createTestArtist({ name: "Various Artists" }),
      label: "self-released",
    });

    renderWithHighlightedEntry(compilation);

    expect(screen.getByTestId("flowsheet-search-artist")).toHaveValue("");
    expect(screen.getByTestId("ghost-text-artist")).toBeInTheDocument();
  });

  it("still suppresses artist ghost text for a normally-credited highlighted release", () => {
    const album = createTestAlbum({
      id: 502,
      title: "On Your Own Love Again",
      artist: createTestArtist({ name: "Jessica Pratt" }),
      label: "Drag City",
    });

    renderWithHighlightedEntry(album);

    expect(screen.getByTestId("flowsheet-search-artist")).toHaveValue(
      "Jessica Pratt"
    );
    expect(screen.queryByTestId("ghost-text-artist")).not.toBeInTheDocument();
  });
});
