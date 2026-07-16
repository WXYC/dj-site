import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
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
import PreviousSetsContainer from "@/src/components/experiences/classic/playlists/PreviousSetsContainer";

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
    // Single rerender simulates the one re-render that RTK Query would
    // trigger in production when its cache state flips from pending to
    // fulfilled. Issue #540: the bug shipped because accumulated results
    // lived in a useRef — the data effect mutated it after render but no
    // additional render happened to project the new array into the DOM.
    rerender(<PreviousSetsContainer />);
    await waitFor(() => {
      expect(screen.getByText("Juana Molina")).toBeDefined();
    });
  });

  // Regression test for #540: when the hook returns total > 0 with results
  // populated, the result table must render on the same render where the
  // count copy appears — no extra re-render required.
  it("renders the result table when the hook returns { total: 5, results: [...5 rows...] }", async () => {
    const { user, rerender } = renderWithProviders(<PreviousSetsContainer />);
    await user.type(
      screen.getByPlaceholderText(/type to search/i),
      "stereolab"
    );
    mockQueryState.data = {
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
    };
    rerender(<PreviousSetsContainer />);

    await waitFor(() => {
      // The count copy is the smoking gun in #540 — it appears even when
      // the table doesn't.
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
