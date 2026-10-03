import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import type { PlaylistSearchResult } from "@wxyc/shared/dtos";

const mockFetchNextPage = vi.fn();
const mockRefetch = vi.fn();
const mockQueryState = {
  data: undefined as
    | {
        pages: Array<{
          results: PlaylistSearchResult[];
          total: number;
          page: number;
          totalPages: number;
          nextCursor?: string;
        }>;
      }
    | undefined,
  // The current key's own pages; `null` means "the same as data". RTK keeps
  // `data` from the last key that answered and `currentData` from this one.
  currentData: null as { pages: unknown[] } | undefined | null,
  isFetching: false,
  isError: false,
  hasNextPage: false,
};

vi.mock("@/lib/features/playlist-search/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/features/playlist-search/api")
  >("@/lib/features/playlist-search/api");
  return {
    ...actual,
    useSearchPlaylistsInfiniteQuery: () =>
      ({
        ...mockQueryState,
        currentData:
          mockQueryState.currentData === null
            ? mockQueryState.data
            : mockQueryState.currentData,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      }) as unknown as ReturnType<
        typeof actual.useSearchPlaylistsInfiniteQuery
      >,
  };
});

// Import after the mock is defined.
import PreviousSetsContainer from "@/src/components/experiences/classic/playlists/PreviousSetsContainer";

beforeEach(() => {
  mockFetchNextPage.mockReset();
  mockRefetch.mockReset();
  mockQueryState.data = undefined;
  mockQueryState.currentData = null;
  mockQueryState.isFetching = false;
  mockQueryState.isError = false;
  mockQueryState.hasNextPage = false;
});

describe("Classic Previous Sets PreviousSetsContainer", () => {
  it("renders the Classic page title", () => {
    renderWithProviders(<PreviousSetsContainer />);
    expect(
      screen.getByRole("heading", { name: /playlist archive/i })
    ).toBeDefined();
  });

  it("renders a search input", () => {
    renderWithProviders(<PreviousSetsContainer />);
    expect(screen.getByPlaceholderText(/type to search/i)).toBeDefined();
  });

  it("lists recent entries before the user has typed anything", async () => {
    mockQueryState.data = {
      pages: [
        {
          results: [
            {
              id: 900,
              play_date: "2026-08-23T14:30:00.000Z",
              artist_name: "Chuquimamani-Condori",
              track_title: "Call Your Name",
              album_title: "Edits",
              record_label: "self-released",
              dj_name: "DJ Chowder",
              show_id: 300,
            },
          ],
          total: 1,
          page: 0,
          totalPages: 1,
        },
      ],
    };

    const { container } = renderWithProviders(<PreviousSetsContainer />);

    await waitFor(() => {
      expect(screen.getByText("Chuquimamani-Condori")).toBeDefined();
    });
    expect(container.querySelector("table thead")).not.toBeNull();
  });

  it("does not report a result count for the default listing", async () => {
    mockQueryState.data = {
      pages: [
        {
          results: [
            {
              id: 901,
              play_date: "2026-08-23T14:30:00.000Z",
              artist_name: "Cat Power",
              track_title: "Cross Bones Style",
              album_title: "Moon Pix",
              record_label: "Matador",
              dj_name: "DJ Chowder",
              show_id: 300,
            },
          ],
          total: 1,
          page: 0,
          totalPages: 1,
        },
      ],
    };

    renderWithProviders(<PreviousSetsContainer />);

    await waitFor(() => {
      expect(screen.getByText("Cat Power")).toBeDefined();
    });
    // "Found 1 results" answers a question the DJ did not ask, and "No results
    // found" would be a lie about the archive. Both belong to a real query.
    expect(screen.queryByText(/found 1 results/i)).toBeNull();
    expect(screen.queryByText(/no results found/i)).toBeNull();
  });

  it("still shows nothing for a sub-threshold partial query", async () => {
    // Rows must be in hand for this to prove anything. With `data` left
    // undefined the table is empty whatever the gate does, and the assertion
    // passes just as happily with the threshold removed altogether.
    mockQueryState.data = {
      pages: [
        {
          results: [
            {
              id: 902,
              play_date: "2026-08-23T14:30:00.000Z",
              artist_name: "Jessica Pratt",
              track_title: "Back, Baby",
              album_title: "On Your Own Love Again",
              record_label: "Drag City",
              dj_name: "DJ Chowder",
              show_id: 300,
            },
          ],
          total: 1,
          page: 0,
          totalPages: 1,
        },
      ],
    };

    const { user, container } = renderWithProviders(<PreviousSetsContainer />);

    // The default listing is on screen first, so the disappearance below is
    // the gate acting rather than the fixture never having arrived.
    await waitFor(() => {
      expect(screen.getByText("Jessica Pratt")).toBeDefined();
    });

    await user.type(screen.getByPlaceholderText(/type to search/i), "a");

    await waitFor(() => {
      expect(container.querySelector("table thead")).toBeNull();
    });
    expect(screen.queryByText("Jessica Pratt")).toBeNull();
  });

  it("renders the result table after the user types and data arrives", async () => {
    const { user, rerender } = renderWithProviders(<PreviousSetsContainer />);
    const input = screen.getByPlaceholderText(/type to search/i);
    await user.type(input, "Juana");
    // Land the response after typing, then rerender to project the fulfilled
    // page into the DOM.
    mockQueryState.data = {
      pages: [
        {
          results: [
            {
              id: 1,
              play_date: "2024-06-15T14:30:00.000Z",
              artist_name: "Juana Molina",
              track_title: "la paradoja",
              album_title: "DOGA",
              record_label: "Sonamos",
              dj_name: "Test DJ",
              show_id: 100,
            },
          ],
          total: 1,
          page: 0,
          totalPages: 1,
        },
      ],
    };
    rerender(<PreviousSetsContainer />);
    await waitFor(() => {
      expect(screen.getByText("Juana Molina")).toBeDefined();
    });
  });

  // The count copy and the populated rows must appear on the same render.
  it("renders the result table when the hook returns { total: 5, results: [...5 rows...] }", async () => {
    const { user, rerender } = renderWithProviders(<PreviousSetsContainer />);
    await user.type(
      screen.getByPlaceholderText(/type to search/i),
      "stereolab"
    );
    mockQueryState.data = {
      pages: [
        {
          results: [
            {
              id: 10,
              play_date: "2024-06-15T14:30:00.000Z",
              artist_name: "Stereolab",
              track_title: "Brakhage",
              album_title: "Dots and Loops",
              record_label: "Duophonic",
              dj_name: "Test DJ",
              show_id: 200,
            },
            {
              id: 11,
              play_date: "2024-06-15T14:35:00.000Z",
              artist_name: "Stereolab",
              track_title: "Miss Modular",
              album_title: "Dots and Loops",
              record_label: "Duophonic",
              dj_name: "Test DJ",
              show_id: 200,
            },
            {
              id: 12,
              play_date: "2024-06-15T14:40:00.000Z",
              artist_name: "Stereolab",
              track_title: "The Flower Called Nowhere",
              album_title: "Dots and Loops",
              record_label: "Duophonic",
              dj_name: "Test DJ",
              show_id: 200,
            },
            {
              id: 13,
              play_date: "2024-06-15T14:45:00.000Z",
              artist_name: "Stereolab",
              track_title: "Diagonals",
              album_title: "Dots and Loops",
              record_label: "Duophonic",
              dj_name: "Test DJ",
              show_id: 200,
            },
            {
              id: 14,
              play_date: "2024-06-15T14:50:00.000Z",
              artist_name: "Stereolab",
              track_title: "Prisoner of Mars",
              album_title: "Dots and Loops",
              record_label: "Duophonic",
              dj_name: "Test DJ",
              show_id: 200,
            },
          ],
          total: 5,
          page: 0,
          totalPages: 1,
        },
      ],
    };
    rerender(<PreviousSetsContainer />);

    await waitFor(() => {
      // The count copy must not appear without the rows beneath it.
      expect(screen.getByText(/found 5 results/i)).toBeDefined();
    });
    // The actual fix: the table renders, with all five rows.
    expect(screen.getByText("Brakhage")).toBeDefined();
    expect(screen.getByText("Miss Modular")).toBeDefined();
    expect(screen.getByText("The Flower Called Nowhere")).toBeDefined();
    expect(screen.getByText("Diagonals")).toBeDefined();
    expect(screen.getByText("Prisoner of Mars")).toBeDefined();
  });

  it("shows an error message when the search request fails", async () => {
    const { user, rerender } = renderWithProviders(<PreviousSetsContainer />);
    await user.type(screen.getByPlaceholderText(/type to search/i), "Juana");
    mockQueryState.data = {
      pages: [
        {
          results: [
            {
              id: 903,
              play_date: "2026-08-23T15:00:00.000Z",
              artist_name: "Juana Molina",
              track_title: "la paradoja",
              album_title: "DOGA",
              record_label: "Sonamos",
              dj_name: "DJ Chowder",
              show_id: 301,
            },
          ],
          total: 1,
          page: 0,
          totalPages: 1,
        },
      ],
    };
    rerender(<PreviousSetsContainer />);

    // The count line is scoped to a *settled* real query, so it has to have
    // been on screen once for its absence below to mean anything: asserted
    // before the query settles, the absence passes whatever the gate does.
    await screen.findByText(/found 1 results/i);

    mockQueryState.isError = true;
    mockQueryState.data = undefined;
    rerender(<PreviousSetsContainer />);

    await waitFor(() => {
      expect(
        screen.getByText(/an error occurred while searching/i)
      ).toBeDefined();
    });
    // A failed query has no page to read a total from, so the count falls back
    // to zero. Left ungated, this line answers the DJ's search with "no
    // results" directly above the notice saying the search never ran.
    expect(screen.queryByText(/no results found/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  describe("the failure notice", () => {
    const page = {
      results: [
        {
          id: 10001,
          play_date: "2026-01-01T00:00:00.000Z",
          artist_name: "Juana Molina",
          track_title: "la paradoja",
          album_title: "DOGA",
          record_label: "Sonamos",
          dj_name: "DJ Chowder",
          show_id: 301,
        },
      ],
      total: 120,
      page: 0,
      totalPages: 3,
    };

    // Placed where the reader is looking: above the listing when the search
    // itself failed (here a re-sorted search, so the previous sort's rows are
    // still on screen), below its rows when a page failed while scrolling.
    it.each([
      { failed: "the first page", currentData: undefined, below: false },
      { failed: "a later page", currentData: null, below: true },
    ])("sits below the rows only when $failed failed", ({ currentData, below }) => {
      mockQueryState.data = { pages: [page] };
      mockQueryState.currentData = currentData;
      mockQueryState.hasNextPage = true;
      mockQueryState.isError = true;

      renderWithProviders(<PreviousSetsContainer initialResults={[page.results[0]]} />);

      const notice = screen.getByRole("alert");
      const rows = screen.getByRole("table");
      const following =
        rows.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING;
      expect(following !== 0).toBe(below);
    });

    it("stays up, inert, while the retry runs, and leaves when it succeeds", async () => {
      mockQueryState.isError = true;
      const { user, rerender } = renderWithProviders(<PreviousSetsContainer />);

      await user.click(screen.getByRole("button", { name: "Try again" }));
      expect(mockRefetch).toHaveBeenCalledTimes(1);

      mockQueryState.isError = false;
      mockQueryState.isFetching = true;
      rerender(<PreviousSetsContainer />);
      const control = await screen.findByRole("button", { name: "Retrying…" });
      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(control).not.toHaveAttribute("disabled");
      await user.click(control);
      expect(mockRefetch).toHaveBeenCalledTimes(1);

      mockQueryState.isFetching = false;
      mockQueryState.data = { pages: [page] };
      rerender(<PreviousSetsContainer />);
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });
  });

  it("gives the control back, and announces again, when the retry fails too", async () => {
    mockQueryState.isError = true;
    const { user, rerender } = renderWithProviders(<PreviousSetsContainer />);
    const firstAnnouncement = screen.getByRole("alert");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    mockQueryState.isError = false;
    mockQueryState.isFetching = true;
    rerender(<PreviousSetsContainer />);
    await screen.findByRole("button", { name: "Retrying…" });

    mockQueryState.isFetching = false;
    mockQueryState.isError = true;
    rerender(<PreviousSetsContainer />);

    const control = await screen.findByRole("button", { name: "Try again" });
    expect(control).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("alert")).not.toBe(firstAnnouncement);
  });

  // tubafrenzy's own summary line, above its results table for twenty years.
  // Nothing else on the screen says the rows go anywhere.
  it("tells the reader the rows are clickable", async () => {
    mockQueryState.data = {
      pages: [
        {
          results: [
            {
              id: 903,
              play_date: "2026-08-23T14:30:00.000Z",
              artist_name: "Duke Ellington & John Coltrane",
              track_title: "In a Sentimental Mood",
              album_title: "Duke Ellington & John Coltrane",
              record_label: "Impulse Records",
              dj_name: "DJ Chowder",
              show_id: 300,
            },
          ],
          total: 1,
          page: 0,
          totalPages: 1,
        },
      ],
    };

    renderWithProviders(<PreviousSetsContainer />);

    await waitFor(() => {
      expect(
        screen.getByText("Click a track to see the full show.")
      ).toBeDefined();
    });
  });

  it("keeps that invitation off an empty listing", async () => {
    const { user, rerender } = renderWithProviders(<PreviousSetsContainer />);
    await user.type(screen.getByPlaceholderText(/type to search/i), "Juana");
    mockQueryState.data = {
      pages: [{ results: [], total: 0, page: 0, totalPages: 0 }],
    };
    rerender(<PreviousSetsContainer />);

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeDefined();
    });
    expect(
      screen.queryByText("Click a track to see the full show.")
    ).toBeNull();
  });
});
