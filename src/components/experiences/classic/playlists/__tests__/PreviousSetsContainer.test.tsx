import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import type { PlaylistSearchResult } from "@wxyc/shared/dtos";

const mockTrigger = vi.fn();
const mockQueryState = {
  data: undefined as
    | {
        results: PlaylistSearchResult[];
        total: number;
        page: number;
        totalPages: number;
        nextCursor?: string;
      }
    | undefined,
  isFetching: false,
  isError: false,
};

vi.mock("@/lib/features/playlist-search/api", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/features/playlist-search/api")
  >("@/lib/features/playlist-search/api");
  return {
    ...actual,
    useLazySearchPlaylistsQuery: () =>
      [mockTrigger, mockQueryState] as unknown as ReturnType<
        typeof actual.useLazySearchPlaylistsQuery
      >,
  };
});

// Import after the mock is defined.
import PreviousSetsContainer from "../PreviousSetsContainer";

beforeEach(() => {
  mockTrigger.mockReset();
  mockQueryState.data = undefined;
  mockQueryState.isFetching = false;
  mockQueryState.isError = false;
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
    // Land the response AFTER typing so the data effect ([data, cursor])
    // fires its accumulator update — the reset effect (which clears on
    // effectiveQuery change) doesn't fire again on this render.
    mockQueryState.data = {
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
    };
    rerender(<PreviousSetsContainer />); // data effect runs, populates ref
    rerender(<PreviousSetsContainer />); // re-read ref into the DOM
    await waitFor(() => {
      expect(screen.getByText("Juana Molina")).toBeDefined();
    });
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
