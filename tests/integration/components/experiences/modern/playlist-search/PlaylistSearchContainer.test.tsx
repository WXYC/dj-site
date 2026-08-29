import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { PlaylistSearchContainer } from "@/src/components/experiences/modern/playlist-search";

const mockUsePlaylistSearchResults = vi.fn();

// The container consumes usePlaylistSearchResults, which owns the seed-vs-client
// decision; that derivation is exercised in tests/unit/hooks. What is asserted
// here is the rendering contract: given a display decision, what reaches the DOM.
vi.mock("@/src/hooks/playlistSearchHooks", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/hooks/playlistSearchHooks")>();
  return {
    ...actual,
    usePlaylistSearchResults: () => mockUsePlaylistSearchResults(),
  };
});

vi.mock(
  "@/src/components/experiences/modern/previous-sets/Search/SearchBar",
  () => ({ default: () => <div data-testid="search-bar" /> }),
);

vi.mock(
  "@/src/components/experiences/modern/playlist-search/PlaylistResultsTable",
  () => ({
    default: ({ results }: { results: PlaylistSearchResult[] }) => (
      <div
        data-testid="results-table"
        data-row-ids={results.map((r) => r.id).join(",")}
      />
    ),
  }),
);

vi.mock(
  "@/src/components/experiences/modern/playlist-search/PlaylistInfiniteScroll",
  () => ({
    default: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="infinite-scroll">{children}</div>
    ),
  }),
);

function makeResult(id: number): PlaylistSearchResult {
  return {
    id,
    play_date: "2024-11-01T00:00:00Z",
    artist_name: "Jessica Pratt",
    track_title: "Back, Baby",
    album_title: "On Your Own Love Again",
    record_label: "Drag City",
    dj_name: "DJ Test",
    show_id: 1,
  };
}

const baseHookReturn = {
  sortBy: "date" as const,
  sortOrder: "desc" as const,
  handleSort: vi.fn(),
  displayResults: [] as PlaylistSearchResult[],
  total: 0,
  hasMore: false,
  isLoading: false,
  isError: false,
  loadNextPage: vi.fn(),
  showResults: true,
  isRealQuery: false,
};

/** Mirrors what usePlaylistSearchResults returns for a given query shape. */
const forDefaultQuery = (displayResults: PlaylistSearchResult[]) => ({
  ...baseHookReturn,
  displayResults,
  showResults: true,
  isRealQuery: false,
});
const forRealQuery = (displayResults: PlaylistSearchResult[], total: number) => ({
  ...baseHookReturn,
  displayResults,
  total,
  showResults: true,
  isRealQuery: true,
});
const forPartialQuery = () => ({
  ...baseHookReturn,
  displayResults: [],
  showResults: false,
  isRealQuery: false,
});

describe("PlaylistSearchContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlaylistSearchResults.mockReturnValue({ ...baseHookReturn });
  });

  it("renders the rows the hook designates for the default query", () => {
    mockUsePlaylistSearchResults.mockReturnValue(
      forDefaultQuery([makeResult(11), makeResult(12)]),
    );
    render(
      <PlaylistSearchContainer
        initialResults={[makeResult(11), makeResult(12)]}
      />,
    );
    expect(screen.getByTestId("results-table")).toHaveAttribute(
      "data-row-ids",
      "11,12",
    );
  });

  it("renders client rows once the hook has retired the seed", () => {
    mockUsePlaylistSearchResults.mockReturnValue(
      forDefaultQuery([makeResult(50)]),
    );
    render(
      <PlaylistSearchContainer initialResults={[makeResult(11)]} />,
    );
    expect(screen.getByTestId("results-table")).toHaveAttribute(
      "data-row-ids",
      "50",
    );
  });

  it("renders client results and a count for a real query", () => {
    mockUsePlaylistSearchResults.mockReturnValue(
      forRealQuery([makeResult(1), makeResult(2)], 2),
    );
    render(<PlaylistSearchContainer />);
    expect(screen.getByTestId("results-table")).toHaveAttribute(
      "data-row-ids",
      "1,2",
    );
    expect(screen.getByText("Found 2 results")).toBeInTheDocument();
  });

  it("shows nothing for a single-character partial query", () => {
    mockUsePlaylistSearchResults.mockReturnValue(forPartialQuery());
    render(
      <PlaylistSearchContainer initialResults={[makeResult(11)]} />,
    );
    expect(screen.queryByTestId("results-table")).not.toBeInTheDocument();
  });

  it("does not render the table when there are no rows to show", () => {
    mockUsePlaylistSearchResults.mockReturnValue(forDefaultQuery([]));
    render(<PlaylistSearchContainer initialResults={[]} />);
    expect(screen.queryByTestId("results-table")).not.toBeInTheDocument();
  });
});
