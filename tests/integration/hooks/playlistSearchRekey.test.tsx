import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { http, HttpResponse, delay } from "msw";
import { createTestStore, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";
import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";

// The base query's prepareHeaders fetches a JWT; no auth server runs here.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

function makeRow(id: number, sort: string) {
  return {
    id,
    play_date: "2024-06-15T14:30:00.000Z",
    artist_name: `artist-${sort}`,
    track_title: `title-${sort}`,
    album_title: "album",
    record_label: "label",
    dj_name: "dj",
    show_id: 1,
  };
}

describe("usePlaylistSearch — mid-flight param change (real store + RTK)", () => {
  it("re-keys on a mid-flight sort change so final results reflect the new params with no stale-page leak", async () => {
    // sort=date is slow (its fetch is still in flight when the sort changes);
    // sort=artist responds immediately. Each sort returns a distinct id so a
    // leak from the stale in-flight entry into the subscribed one is detectable.
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/search`, async ({ request }) => {
        const sort = new URL(request.url).searchParams.get("sort");
        if (sort === "artist") {
          return HttpResponse.json({
            results: [makeRow(2, "artist")],
            total: 1,
            page: 0,
            totalPages: 1,
          });
        }
        await delay(60);
        return HttpResponse.json({
          results: [makeRow(1, "date")],
          total: 1,
          page: 0,
          totalPages: 1,
        });
      }),
    );

    const store = createTestStore();
    const rowId = store.getState().playlistSearch.rows[0].id;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(Provider, { store, children });

    const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

    // Type a query — its sort=date fetch is slow and goes in flight.
    act(() => {
      store.dispatch(
        playlistSearchSlice.actions.updateRow({
          id: rowId,
          updates: { value: "abc" },
        }),
      );
    });

    // While that fetch is in flight, change the sort. RTK re-keys the
    // subscription to {q:abc, sort:artist} and fetches the new entry.
    act(() => {
      store.dispatch(playlistSearchSlice.actions.setSort("artist"));
    });

    // Final results reflect the new sort, not the slow in-flight date fetch.
    await waitFor(() =>
      expect(result.current.results.map((r) => r.id)).toEqual([2]),
    );

    // Let the slow date response land; it populates its now-unsubscribed cache
    // entry and must never leak into the subscribed artist entry.
    await delay(150);
    expect(result.current.results.map((r) => r.id)).toEqual([2]);
  });
});
