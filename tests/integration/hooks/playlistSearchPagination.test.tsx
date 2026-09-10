import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import type { RootState } from "@/lib/store";
import { createTestStore, server } from "@/tests/helpers";
import { playlistSearchFake } from "@/tests/fakes/playlistSearch";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";
import type { PlaylistSearchState } from "@/lib/features/playlist-search/frontend";
import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";

// The base query's prepareHeaders fetches a JWT; no auth server runs here.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

const PAGE = 50;

/**
 * Seeds the sort directly rather than dispatching `setSort`, so a walk that
 * starts under a non-date sort does not also depend on how the reducer maps a
 * field to a direction.
 */
function mountAt(sort: PlaylistSearchState["sortBy"]) {
  const preloaded: Partial<RootState> = {
    playlistSearch: { ...playlistSearchSlice.getInitialState(), sortBy: sort },
  };
  const store = createTestStore(preloaded);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store, children });
  return { store, ...renderHook(() => usePlaylistSearch(), { wrapper }) };
}

type Walker = ReturnType<typeof mountAt>["result"];

/** Scrolls to the bottom once and waits for the appended page to land. */
async function loadMore(result: Walker, expectedRows: number) {
  await waitFor(() => expect(result.current.hasMore).toBe(true));
  act(() => {
    result.current.loadNextPage();
  });
  await waitFor(() => expect(result.current.results).toHaveLength(expectedRows));
}

describe("Previous Sets pagination (real store + RTK)", () => {
  it("walks a non-date sort past the first page, by offset", async () => {
    const fake = playlistSearchFake({ archiveSize: 120 });
    server.use(fake.handler);

    const { result } = mountAt("artist");

    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    await loadMore(result, 2 * PAGE);
    await loadMore(result, 120);

    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(fake.requests.map((r) => r.page)).toEqual([0, 1, 2]);
    expect(fake.requests.every((r) => r.cursor === null)).toBe(true);
  });

  it("walks the date sort by cursor, never by offset", async () => {
    const fake = playlistSearchFake({ archiveSize: 120 });
    server.use(fake.handler);

    const { result } = mountAt("date");

    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    await loadMore(result, 2 * PAGE);
    await loadMore(result, 120);

    expect(fake.requests.map((r) => r.page)).toEqual([0, 0, 0]);
    expect(fake.requests.map((r) => r.cursor)).toEqual([
      null,
      `after:${fake.rows[PAGE - 1].id}`,
      `after:${fake.rows[2 * PAGE - 1].id}`,
    ]);
  });

  it("keeps walking a non-date sort past the page count a capped total implies", async () => {
    // `total` is capped server-side, so `totalPages` is a lower bound: here it
    // claims two pages over an archive that holds three.
    const fake = playlistSearchFake({ archiveSize: 120, reportedTotal: 60 });
    server.use(fake.handler);

    const { result } = mountAt("dj");

    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    await loadMore(result, 2 * PAGE);
    await loadMore(result, 120);

    expect(result.current.hasMore).toBe(false);
  });

  it("never returns a cursor to a non-date sort, even one the backend leaked", async () => {
    // A cursor issued under a non-date sort is dropped on intake, so sending it
    // back re-serves page 0 and the walk never advances.
    const fake = playlistSearchFake({
      archiveSize: 120,
      emitCursorForEverySort: true,
    });
    server.use(fake.handler);

    const { result } = mountAt("song");

    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    await loadMore(result, 2 * PAGE);

    expect(fake.requests.every((r) => r.cursor === null)).toBe(true);
    expect(fake.requests.map((r) => r.page)).toEqual([0, 1]);
  });

  it("drops the cursor when the sort changes off date", async () => {
    const fake = playlistSearchFake({ archiveSize: 120 });
    server.use(fake.handler);

    const { store, result } = mountAt("date");

    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    await loadMore(result, 2 * PAGE);

    act(() => {
      store.dispatch(
        playlistSearchSlice.actions.setSort({ sortBy: "artist", sortOrder: "desc" }),
      );
    });

    await waitFor(() =>
      expect(fake.requests[fake.requests.length - 1].sort).toBe("artist"),
    );
    const resumed = fake.requests[fake.requests.length - 1];
    expect(resumed.cursor).toBeNull();
    expect(resumed.page).toBe(0);
  });

  it("drops the offset when the sort changes onto date", async () => {
    const fake = playlistSearchFake({ archiveSize: 120 });
    server.use(fake.handler);

    const { store, result } = mountAt("artist");

    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    await loadMore(result, 2 * PAGE);

    act(() => {
      store.dispatch(
        playlistSearchSlice.actions.setSort({ sortBy: "date", sortOrder: "desc" }),
      );
    });

    await waitFor(() =>
      expect(fake.requests[fake.requests.length - 1].sort).toBe("date"),
    );
    const resumed = fake.requests[fake.requests.length - 1];
    expect(resumed.cursor).toBeNull();
    expect(resumed.page).toBe(0);
  });

  it("restarts a non-date walk at the first page when a search row is edited", async () => {
    const fake = playlistSearchFake({ archiveSize: 120 });
    server.use(fake.handler);

    const { store, result } = mountAt("artist");
    const rowId = store.getState().playlistSearch.rows[0].id;

    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    await loadMore(result, 2 * PAGE);

    act(() => {
      store.dispatch(
        playlistSearchSlice.actions.updateRow({
          id: rowId,
          updates: { value: "Chuquimamani-Condori" },
        }),
      );
    });

    await waitFor(() =>
      expect(fake.requests[fake.requests.length - 1].q).toBe(
        "Chuquimamani-Condori",
      ),
    );
    const restarted = fake.requests[fake.requests.length - 1];
    expect(restarted.cursor).toBeNull();
    expect(restarted.page).toBe(0);
  });
});
