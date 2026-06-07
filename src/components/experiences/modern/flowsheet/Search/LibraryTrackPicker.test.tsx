import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  createTestStore,
} from "@/lib/test-utils";
import LibraryTrackPicker, {
  useLibraryTrackPicker,
} from "./LibraryTrackPicker";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";

function mockLibraryTracksResponse(
  libraryId: number,
  tracks: Array<{ position: string; title: string; artist_credit: string }>,
  source: "discogs" | null = "discogs"
) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/proxy/library/${libraryId}/tracks`, () =>
      HttpResponse.json({
        library_id: libraryId,
        discogs_release_id: source === "discogs" ? 42 : null,
        source,
        tracks: tracks.map((t) => ({ ...t, duration_ms: null })),
      })
    )
  );
}

describe("useLibraryTrackPicker", () => {
  it("returns show=false when albumId is null", () => {
    const { result } = renderHook(() => useLibraryTrackPicker(null), {
      wrapper: ({ children }) => (
        <Provider store={createTestStore()}>{children}</Provider>
      ),
    });
    expect(result.current.show).toBe(false);
    expect(result.current.tracks).toEqual([]);
  });

  it("returns show=true with adapted tracks when the release has a tracklist", async () => {
    mockLibraryTracksResponse(1001, [
      { position: "A1", title: "la paradoja", artist_credit: "Juana Molina" },
      { position: "A2", title: "doga", artist_credit: "Juana Molina" },
    ]);

    const { result } = renderHook(() => useLibraryTrackPicker(1001), {
      wrapper: ({ children }) => (
        <Provider store={createTestStore()}>{children}</Provider>
      ),
    });

    await waitFor(() => expect(result.current.show).toBe(true));
    expect(result.current.tracks).toHaveLength(2);
    expect(result.current.tracks[0]).toMatchObject({
      position: "A1",
      title: "la paradoja",
      artists: ["Juana Molina"],
    });
  });

  it("returns show=false when source is null (no Discogs identity)", async () => {
    mockLibraryTracksResponse(99, [], null);
    const { result } = renderHook(() => useLibraryTrackPicker(99), {
      wrapper: ({ children }) => (
        <Provider store={createTestStore()}>{children}</Provider>
      ),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.show).toBe(false);
  });

  it("returns show=false when the tracklist is empty", async () => {
    mockLibraryTracksResponse(2002, []);
    const { result } = renderHook(() => useLibraryTrackPicker(2002), {
      wrapper: ({ children }) => (
        <Provider store={createTestStore()}>{children}</Provider>
      ),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.show).toBe(false);
  });
});

describe("LibraryTrackPicker", () => {
  it("writes track_title (via song) and track_position when a track is picked", async () => {
    const tracks = [
      {
        position: "A1",
        title: "la paradoja",
        artist_credit: "Juana Molina",
        duration_ms: null,
        artists: ["Juana Molina"],
      },
    ];

    const { store, user } = renderWithProviders(
      <LibraryTrackPicker
        tracks={tracks}
        isLoading={false}
        disabled={false}
        onManualEntry={() => {}}
      />
    );

    // Open dropdown via trigger
    await user.click(screen.getByTestId("track-picker-combobox"));
    await user.click(screen.getByTestId("track-picker-option-0"));

    const state = store.getState();
    expect(state.flowsheet.search.query.song).toBe("la paradoja");
    expect(state.flowsheet.search.query.track_position).toBe("A1");
  });

  it("clears track_position and calls onManualEntry on the manual fallback", async () => {
    const tracks = [
      {
        position: "A1",
        title: "la paradoja",
        artist_credit: "Juana Molina",
        duration_ms: null,
        artists: ["Juana Molina"],
      },
    ];

    let manualFired = false;
    const { store, user } = renderWithProviders(
      <LibraryTrackPicker
        tracks={tracks}
        isLoading={false}
        disabled={false}
        onManualEntry={() => {
          manualFired = true;
        }}
      />,
      {
        preloadedState: {
          flowsheet: {
            ...flowsheetSlice.getInitialState(),
            search: {
              ...flowsheetSlice.getInitialState().search,
              query: {
                ...flowsheetSlice.getInitialState().search.query,
                track_position: "A1",
              },
            },
          },
        },
      }
    );

    await user.click(screen.getByTestId("track-picker-combobox"));
    fireEvent.click(screen.getByTestId("track-picker-manual"));

    expect(manualFired).toBe(true);
    expect(store.getState().flowsheet.search.query.track_position).toBeUndefined();
  });
});
