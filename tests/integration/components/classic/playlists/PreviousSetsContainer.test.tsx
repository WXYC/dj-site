import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import type { PlaylistSearchResult } from "@wxyc/shared/dtos";

const mockFetchNextPage = vi.fn();
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
        fetchNextPage: mockFetchNextPage,
      }) as unknown as ReturnType<
        typeof actual.useSearchPlaylistsInfiniteQuery
      >,
  };
});

// Import after the mock is defined.
import PreviousSetsContainer from "@/src/components/experiences/classic/playlists/PreviousSetsContainer";

beforeEach(() => {
  mockFetchNextPage.mockReset();
  mockQueryState.data = undefined;
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

  it("does not render the results section before the user has typed", () => {
    const { container } = renderWithProviders(<PreviousSetsContainer />);
    expect(container.querySelector("table thead")).toBeNull();
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
    mockQueryState.isError = true;
    rerender(<PreviousSetsContainer />);
    await waitFor(() => {
      expect(
        screen.getByText(/an error occurred while searching/i)
      ).toBeDefined();
    });
  });
});
