import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import type { PlaylistSearchResult } from "@wxyc/shared";
import Results from "@/src/components/experiences/modern/previous-sets/Results/Results";

const mockUsePlaylistSearchResults = vi.fn();

vi.mock("@/src/hooks/playlistSearchHooks", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/hooks/playlistSearchHooks")>();
  return {
    ...actual,
    usePlaylistSearchResults: () => mockUsePlaylistSearchResults(),
  };
});

const ROWS: Omit<PlaylistSearchResult, "id">[] = [
  {
    play_date: "2026-08-23T15:00:00Z",
    artist_name: "Juana Molina",
    track_title: "la paradoja",
    album_title: "DOGA",
    record_label: "Sonamos",
    dj_name: "DJ Chowder",
    show_id: 1,
  },
  {
    play_date: "2026-08-23T15:04:00Z",
    artist_name: "Jessica Pratt",
    track_title: "Back, Baby",
    album_title: "On Your Own Love Again",
    record_label: "Drag City",
    dj_name: "DJ Chowder",
    show_id: 1,
  },
];

function makeResult(id: number): PlaylistSearchResult {
  return { id, ...ROWS[id % ROWS.length] };
}

const base = {
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
  usingSeed: false,
};

const CURTAIN = /keep typing/i;

describe("Results (modern previous sets)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlaylistSearchResults.mockReturnValue({ ...base });
  });

  it("lists entries for the default query with no search term entered", () => {
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [makeResult(0), makeResult(1)],
      showResults: true,
      isRealQuery: false,
    });

    render(<Results />);

    expect(screen.getByText("Back, Baby")).toBeInTheDocument();
    expect(screen.getByText("la paradoja")).toBeInTheDocument();
  });

  it("does not cover the default listing with the prompt curtain", () => {
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [makeResult(1)],
      showResults: true,
    });

    render(<Results />);

    expect(screen.queryByText(CURTAIN)).not.toBeInTheDocument();
  });

  it("prompts only while the query is a sub-threshold partial", () => {
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [],
      showResults: false,
      isRealQuery: false,
    });

    render(<Results />);

    expect(screen.getByText(CURTAIN)).toBeInTheDocument();
  });

  it("reports an empty result set only for a real query", () => {
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [],
      showResults: true,
      isRealQuery: true,
    });

    render(<Results />);

    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("does not accuse the default listing of being empty while it loads", () => {
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [],
      showResults: true,
      isRealQuery: false,
      isLoading: true,
    });

    render(<Results />);

    expect(screen.queryByText("No results found")).not.toBeInTheDocument();
  });

  it("claims no total while the server seed is standing in", () => {
    // `total` and `hasMore` describe the client query, which has not answered
    // yet. Rendered anyway, the footer sits under a full page of seeded rows
    // announcing "0 results" — an end-of-list claim about a list it cannot
    // see.
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [makeResult(0), makeResult(1)],
      usingSeed: true,
      total: 0,
      hasMore: false,
    });

    render(<Results />);

    expect(screen.getByText("la paradoja")).toBeInTheDocument();
    expect(screen.queryByText(/0 results/i)).toBeNull();
  });

  it("reports the total once the client query owns the rows", () => {
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [makeResult(0), makeResult(1)],
      usingSeed: false,
      total: 2,
      hasMore: false,
    });

    render(<Results />);

    expect(screen.getByText(/2 results/i)).toBeInTheDocument();
  });
});
