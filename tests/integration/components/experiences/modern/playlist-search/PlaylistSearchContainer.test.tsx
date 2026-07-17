import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { PlaylistSearchContainer } from "@/src/components/experiences/modern/playlist-search";

const mockUsePlaylistSearch = vi.fn();

vi.mock("@/src/hooks/playlistSearchHooks", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/hooks/playlistSearchHooks")>();
  return {
    ...actual,
    usePlaylistSearch: () => mockUsePlaylistSearch(),
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
  results: [] as PlaylistSearchResult[],
  total: 0,
  hasMore: false,
  isLoading: false,
  isError: false,
  loadNextPage: vi.fn(),
  effectiveQuery: "",
};

describe("PlaylistSearchContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlaylistSearch.mockReturnValue({ ...baseHookReturn });
  });

  it("renders the server seed for the empty default query before the client resolves", () => {
    mockUsePlaylistSearch.mockReturnValue({
      ...baseHookReturn,
      effectiveQuery: "",
      results: [],
    });
    render(
      <PlaylistSearchContainer
        initialResults={[makeResult(11), makeResult(12)]}
        initialTotal={2}
      />,
    );
    expect(screen.getByTestId("results-table")).toHaveAttribute(
      "data-row-ids",
      "11,12",
    );
  });

  it("lets resolved client results take over from the seed for the default query", () => {
    mockUsePlaylistSearch.mockReturnValue({
      ...baseHookReturn,
      effectiveQuery: "",
      results: [makeResult(50)],
    });
    render(
      <PlaylistSearchContainer initialResults={[makeResult(11)]} initialTotal={1} />,
    );
    expect(screen.getByTestId("results-table")).toHaveAttribute(
      "data-row-ids",
      "50",
    );
  });

  it("renders client results and a count for a real query", () => {
    mockUsePlaylistSearch.mockReturnValue({
      ...baseHookReturn,
      effectiveQuery: "stereolab",
      results: [makeResult(1), makeResult(2)],
      total: 2,
    });
    render(<PlaylistSearchContainer />);
    expect(screen.getByTestId("results-table")).toHaveAttribute(
      "data-row-ids",
      "1,2",
    );
    expect(screen.getByText("Found 2 results")).toBeInTheDocument();
  });

  it("shows nothing for a single-character partial query", () => {
    mockUsePlaylistSearch.mockReturnValue({
      ...baseHookReturn,
      effectiveQuery: "a",
      results: [],
    });
    render(
      <PlaylistSearchContainer initialResults={[makeResult(11)]} initialTotal={1} />,
    );
    expect(screen.queryByTestId("results-table")).not.toBeInTheDocument();
  });

  it("does not render the seed table when the seed is empty", () => {
    mockUsePlaylistSearch.mockReturnValue({
      ...baseHookReturn,
      effectiveQuery: "",
      results: [],
    });
    render(<PlaylistSearchContainer initialResults={[]} initialTotal={0} />);
    expect(screen.queryByTestId("results-table")).not.toBeInTheDocument();
  });
});
