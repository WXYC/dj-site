import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import type { PlaylistSearchResult } from "@wxyc/shared";
import Results from "@/src/components/experiences/modern/previous-sets/Results/Results";
import type { FailedPage } from "@/src/hooks/playlistSearchHooks";
import { rangeEntry, serveArchive } from "@/tests/fakes/flowsheetRange";

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

// Ranked by default: the chronological listing is its own describe below, and
// these cases exercise the flat table, which only a non-chronological sort mounts.
const base = {
  effectiveQuery: "",
  sortBy: "artist" as const,
  sortOrder: "asc" as const,
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
  retry: vi.fn(),
  failedPage: null as FailedPage | null,
  isRetrying: false,
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

  // An unreadable response leaves this listing with no rows and nothing to say
  // about why — the state in which two decades of archive read as nothing.
  it("reports a failed default listing rather than leaving it blank", () => {
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [],
      showResults: true,
      isRealQuery: false,
      isError: true,
      failedPage: "first" as const,
    });

    render(<Results />);

    expect(
      screen.getByText(/an error occurred while searching/i),
    ).toBeInTheDocument();
  });

  it("does not answer a failed search with an empty result set", () => {
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [],
      showResults: true,
      isRealQuery: true,
      isError: true,
      failedPage: "first" as const,
    });

    render(<Results />);

    expect(screen.queryByText("No results found")).not.toBeInTheDocument();
    expect(
      screen.getByText(/an error occurred while searching/i),
    ).toBeInTheDocument();
  });

  it("calls retry when the failed-search notice's control is used", async () => {
    const retry = vi.fn();
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [],
      showResults: true,
      isError: true,
      failedPage: "first" as const,
      retry,
    });

    const { user } = render(<Results />);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each([
    { listing: "an empty listing", rows: [] as PlaylistSearchResult[] },
    { listing: "rows already on screen", rows: [makeResult(1), makeResult(2)] },
  ])(
    "keeps the notice on screen, inert, while a retry runs over $listing, with no spinner",
    async ({ rows }) => {
      const retry = vi.fn();
      mockUsePlaylistSearchResults.mockReturnValue({
        ...base,
        displayResults: rows,
        showResults: true,
        isLoading: true,
        failedPage: (rows.length ? "later" : "first") as FailedPage,
        isRetrying: true,
        retry,
      });

      const { user } = render(<Results />);
      const control = screen.getByRole("button", { name: "Retrying…" });
      await user.click(control);

      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(retry).not.toHaveBeenCalled();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    },
  );

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

  it("never claims a total the list cannot reach", () => {
    // The backend caps its count and reports a sentinel past the cap, so
    // `total` can exceed what scrolling reaches. The footer is an end-of-list
    // claim, so it counts the rows the list actually holds.
    mockUsePlaylistSearchResults.mockReturnValue({
      ...base,
      displayResults: [makeResult(0), makeResult(1)],
      usingSeed: false,
      total: 10001,
      hasMore: false,
    });

    render(<Results />);

    expect(screen.getByText("2 results")).toBeInTheDocument();
    expect(screen.queryByText(/10,001/)).toBeNull();
  });

  describe("sort direction indicator", () => {
    const SORTABLE = [
      { field: "date" as const, header: "Date" },
      { field: "artist" as const, header: "Artist" },
      { field: "song" as const, header: "Song" },
      { field: "dj" as const, header: "DJ" },
    ];

    // Date descending is the chronological listing, which has no Date column.
    it.each(SORTABLE.filter((column) => column.field !== "date"))(
      "announces a descending $header sort to assistive tech",
      ({ field, header }) => {
        mockUsePlaylistSearchResults.mockReturnValue({
          ...base,
          sortBy: field,
          sortOrder: "desc",
          displayResults: [makeResult(0)],
        });

        render(<Results />);

        expect(
          screen.getByRole("columnheader", { name: header }),
        ).toHaveAttribute("aria-sort", "descending");
      },
    );

    it.each(SORTABLE)(
      "announces an ascending $header sort to assistive tech",
      ({ field, header }) => {
        mockUsePlaylistSearchResults.mockReturnValue({
          ...base,
          sortBy: field,
          sortOrder: "asc",
          displayResults: [makeResult(0)],
        });

        render(<Results />);

        expect(
          screen.getByRole("columnheader", { name: header }),
        ).toHaveAttribute("aria-sort", "ascending");
      },
    );

    it("leaves the columns that are not sorted unannounced", () => {
      mockUsePlaylistSearchResults.mockReturnValue({
        ...base,
        sortBy: "date",
        sortOrder: "asc",
        displayResults: [makeResult(0)],
      });

      render(<Results />);

      for (const { header } of SORTABLE.filter((c) => c.header !== "Date")) {
        expect(
          screen.getByRole("columnheader", { name: header }),
        ).not.toHaveAttribute("aria-sort");
      }
    });
  });

  describe("row links", () => {
    // A result row is a single playcut; the show around it carries the
    // talksets, breakpoints and the plays either side that a DJ came for.
    it("links each row to its show with the played track named", () => {
      mockUsePlaylistSearchResults.mockReturnValue({
        ...base,
        displayResults: [makeResult(1), makeResult(2)],
      });

      render(<Results />);

      // The name leads with the row's date — an aria-label replaces the link's
      // own text, and the Date column has no other source for it — so match on
      // the part the row owns rather than on a locale-formatted timestamp.
      expect(
        screen.getByRole("link", {
          name: /see the full show for Back, Baby by Jessica Pratt$/,
        }),
      ).toHaveAttribute("href", "?show=1&entry=1#entry-1");
      expect(
        screen.getByRole("link", {
          name: /see the full show for la paradoja by Juana Molina$/,
        }),
      ).toHaveAttribute("href", "?show=1&entry=2#entry-2");
    });

    it("exposes one link per row, not one per cell", () => {
      mockUsePlaylistSearchResults.mockReturnValue({
        ...base,
        displayResults: [makeResult(1), makeResult(2)],
      });

      render(<Results />);

      expect(screen.getAllByRole("link")).toHaveLength(2);
    });

    // The backend projects a null show_id as 0, so an unattached play would
    // otherwise link to a show that cannot exist.
    it("renders unlinked when the play belongs to no show", () => {
      mockUsePlaylistSearchResults.mockReturnValue({
        ...base,
        displayResults: [{ ...makeResult(1), show_id: 0 }],
      });

      render(<Results />);

      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText("Back, Baby")).toBeInTheDocument();
    });

    it("tells the reader the rows are clickable", () => {
      mockUsePlaylistSearchResults.mockReturnValue({
        ...base,
        displayResults: [makeResult(1)],
      });

      render(<Results />);

      expect(
        screen.getByText("Click a track to see the full show."),
      ).toBeInTheDocument();
    });

    it("keeps that invitation off an empty listing", () => {
      mockUsePlaylistSearchResults.mockReturnValue({
        ...base,
        displayResults: [],
        isRealQuery: true,
      });

      render(<Results />);

      expect(
        screen.queryByText("Click a track to see the full show."),
      ).toBeNull();
    });
  });

  describe("chronological mode", () => {
    const chronological = {
      effectiveQuery: "",
      sortBy: "date" as const,
      sortOrder: "desc" as const,
    };

    // Jsdom lays nothing out, so every scroll height reads zero and the
    // bottom-of-scrollport check would walk the whole archive on its own.
    beforeEach(() => {
      Object.defineProperty(Element.prototype, "scrollHeight", {
        configurable: true,
        get: () => 100_000,
      });
      Object.defineProperty(Element.prototype, "clientHeight", {
        configurable: true,
        get: () => 500,
      });
    });

    afterEach(() => {
      delete (Element.prototype as { scrollHeight?: number }).scrollHeight;
      delete (Element.prototype as { clientHeight?: number }).clientHeight;
    });

    it("mounts the archive table in place of the ranked table", async () => {
      const BASE = Date.parse("2026-10-01T18:00:00.000Z");
      serveArchive(
        Array.from({ length: 5 }, (_, i) => rangeEntry(800000 + i, BASE - i * 60_000)),
      );
      mockUsePlaylistSearchResults.mockReturnValue({ ...base, ...chronological });

      render(<Results />);

      expect(
        await screen.findByRole("table", { name: "playlist archive" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("table", { name: "playlist search results" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("columnheader", { name: "Date" }),
      ).not.toBeInTheDocument();
    });
  });
});
