import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/store";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";

const mockFetchNextPage = vi.fn();

type MockPage = { results: { id: number }[]; total: number; nextCursor?: string };
type MockQueryArg = { q?: string; limit?: number; sort?: string; order?: string };

let lastQueryArg: MockQueryArg | undefined;
let lastSkip = false;
let lastRefetchOnMountOrArgChange: boolean | undefined;

// Mutable canned result for the infinite query. `data.pages` is the RTK page
// array the hook flattens; hasNextPage is RTK's projection of nextCursor via
// getNextPageParam.
const mockInfiniteState = {
  data: undefined as { pages: MockPage[] } | undefined,
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
    useSearchPlaylistsInfiniteQuery: (
      queryArg: MockQueryArg,
      options?: { skip?: boolean; refetchOnMountOrArgChange?: boolean },
    ) => {
      lastQueryArg = queryArg;
      lastSkip = options?.skip ?? false;
      lastRefetchOnMountOrArgChange = options?.refetchOnMountOrArgChange;
      if (options?.skip) {
        return {
          data: undefined,
          isFetching: false,
          isError: false,
          hasNextPage: false,
          fetchNextPage: mockFetchNextPage,
        };
      }
      return { ...mockInfiniteState, fetchNextPage: mockFetchNextPage };
    },
  };
});

import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";

function createWrapper(store?: AppStore) {
  const s = store ?? makeStore();
  return {
    store: s,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(Provider, { store: s, children }),
  };
}

beforeEach(() => {
  mockFetchNextPage.mockReset();
  lastQueryArg = undefined;
  lastSkip = false;
  lastRefetchOnMountOrArgChange = undefined;
  mockInfiniteState.data = undefined;
  mockInfiniteState.isFetching = false;
  mockInfiniteState.isError = false;
  mockInfiniteState.hasNextPage = false;
});

describe("usePlaylistSearch", () => {
  describe("default-recent behavior", () => {
    it("fires an empty-query request on mount so the page shows recent tracks", async () => {
      const { wrapper } = createWrapper();

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(lastQueryArg).toBeDefined());
      expect(lastQueryArg).toEqual(expect.objectContaining({ q: "" }));
      expect(lastSkip).toBe(false);
      // The cursor is RTK's pageParam, not part of the search key; the first
      // page starts from initialPageParam.
      expect(lastQueryArg).not.toHaveProperty("cursor");
    });

    it("forces a fresh fetch on mount rather than serving a stale cached page", async () => {
      const { wrapper } = createWrapper();

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(lastQueryArg).toBeDefined());
      expect(lastRefetchOnMountOrArgChange).toBe(true);
    });

    it("re-fires the empty query when the user clears all rows back to default", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(lastQueryArg?.q).toBe(""));

      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "autechre" },
          }),
        );
      });
      await waitFor(() => expect(lastQueryArg?.q).toBe("autechre"));

      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "" },
          }),
        );
      });
      await waitFor(() => expect(lastQueryArg?.q).toBe(""));
    });
  });

  describe("partial-query debounce", () => {
    it("does not fire while the user has typed only a single character", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(lastSkip).toBe(false));

      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "a" },
          }),
        );
      });

      // A single-char partial skips the query — no request goes out.
      await waitFor(() => expect(lastQueryArg?.q).toBe("a"));
      expect(lastSkip).toBe(true);
    });

    it("fires once the user types a second character", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(lastSkip).toBe(false));

      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "au" },
          }),
        );
      });

      await waitFor(() => {
        expect(lastQueryArg?.q).toBe("au");
        expect(lastSkip).toBe(false);
      });
    });
  });

  describe("cursor pagination", () => {
    it("hasMore is true when the response includes a nextCursor", async () => {
      const { wrapper } = createWrapper();
      mockInfiniteState.data = {
        pages: [
          {
            results: [],
            total: 1000,
            nextCursor: "2024-06-15T14:30:00.000Z_42",
          },
        ],
      };
      mockInfiniteState.hasNextPage = true;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(result.current.hasMore).toBe(true));
    });

    it("hasMore is false when the response has no nextCursor", async () => {
      const { wrapper } = createWrapper();
      mockInfiniteState.data = { pages: [{ results: [], total: 5 }] };
      mockInfiniteState.hasNextPage = false;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(result.current.hasMore).toBe(false));
    });

    it("loadNextPage fetches the next page — RTK advances the cursor internally", async () => {
      const { wrapper } = createWrapper();
      mockInfiniteState.data = {
        pages: [
          {
            results: [{ id: 1 }],
            total: 1000,
            nextCursor: "2024-06-15T14:30:00.000Z_42",
          },
        ],
      };
      mockInfiniteState.hasNextPage = true;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(result.current.hasMore).toBe(true));

      act(() => {
        result.current.loadNextPage();
      });

      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("loadNextPage is a no-op when no nextCursor is available", async () => {
      const { wrapper } = createWrapper();
      mockInfiniteState.data = { pages: [{ results: [{ id: 1 }], total: 1 }] };
      mockInfiniteState.hasNextPage = false;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(result.current.results).toHaveLength(1));

      act(() => {
        result.current.loadNextPage();
      });

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it("editing a row re-keys the query so pagination restarts from the first page", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;
      mockInfiniteState.data = {
        pages: [
          {
            results: [{ id: 1 }],
            total: 1000,
            nextCursor: "2024-06-15T14:30:00.000Z_42",
          },
        ],
      };
      mockInfiniteState.hasNextPage = true;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(result.current.hasMore).toBe(true));

      act(() => {
        result.current.loadNextPage();
      });
      expect(mockFetchNextPage).toHaveBeenCalled();

      // Editing the query changes the search key; RTK serves a fresh cache
      // entry whose pagination starts from initialPageParam (no cursor in the
      // arg).
      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "autechre" },
          }),
        );
      });

      await waitFor(() => expect(lastQueryArg?.q).toBe("autechre"));
      expect(lastQueryArg).not.toHaveProperty("cursor");
    });
  });

  describe("async-race hardening", () => {
    describe("stale results on query change", () => {
      it("does not resurrect the prior query's rows when the query changes", async () => {
        const { store, wrapper } = createWrapper();
        const rowId = store.getState().playlistSearch.rows[0].id;

        mockInfiniteState.data = {
          pages: [{ results: [{ id: 111 }, { id: 222 }], total: 2 }],
        };

        const { result, rerender } = renderHook(() => usePlaylistSearch(), {
          wrapper,
        });
        await waitFor(() =>
          expect(result.current.results.map((r) => r.id)).toEqual([111, 222]),
        );

        // Typing a new query re-keys the cache entry; the fresh entry has no
        // pages yet. Results derive only from the current entry, so the old
        // rows cannot flash back.
        act(() => {
          store.dispatch(
            playlistSearchSlice.actions.updateRow({
              id: rowId,
              updates: { value: "new" },
            }),
          );
        });
        mockInfiniteState.data = undefined;
        rerender();

        await waitFor(() => expect(result.current.results).toEqual([]));
        rerender();
        expect(result.current.results).toEqual([]);
      });

      it("appends and dedupes the next page for the same query", async () => {
        const { wrapper } = createWrapper();

        mockInfiniteState.data = {
          pages: [
            { results: [{ id: 1 }, { id: 2 }], total: 4, nextCursor: "c1" },
          ],
        };
        mockInfiniteState.hasNextPage = true;

        const { result, rerender } = renderHook(() => usePlaylistSearch(), {
          wrapper,
        });
        await waitFor(() =>
          expect(result.current.results.map((r) => r.id)).toEqual([1, 2]),
        );

        act(() => {
          result.current.loadNextPage();
        });
        expect(mockFetchNextPage).toHaveBeenCalled();

        // Page 2 arrives as a second RTK page; the overlapping id 2 is deduped.
        mockInfiniteState.data = {
          pages: [
            { results: [{ id: 1 }, { id: 2 }], total: 4, nextCursor: "c1" },
            { results: [{ id: 2 }, { id: 3 }], total: 4 },
          ],
        };
        mockInfiniteState.hasNextPage = false;
        rerender();

        await waitFor(() =>
          expect(result.current.results.map((r) => r.id)).toEqual([1, 2, 3]),
        );
      });
    });

    // The end-to-end no-stale-leak guarantee is proven against a real store in
    // tests/integration/hooks/playlistSearchRekey.test.tsx. This unit case pins
    // the hook-level mechanism it relies on: the query key is never gated on
    // fetch state, so a sort change made while a fetch is in flight always
    // reaches the key (it cannot be dropped at the hook boundary).
    describe("sort change while a fetch is in flight", () => {
      it("updates the query key even while a fetch is in flight", async () => {
        const { store, wrapper } = createWrapper();
        const rowId = store.getState().playlistSearch.rows[0].id;
        const { rerender } = renderHook(() => usePlaylistSearch(), { wrapper });

        await waitFor(() => expect(lastQueryArg?.q).toBe(""));

        act(() => {
          store.dispatch(
            playlistSearchSlice.actions.updateRow({
              id: rowId,
              updates: { value: "abc" },
            }),
          );
        });
        await waitFor(() =>
          expect(lastQueryArg).toEqual(
            expect.objectContaining({ q: "abc", sort: "date" }),
          ),
        );

        // Mark the abc/date fetch in flight, then change the sort. The key must
        // still advance to sort:artist — the hook does not read isFetching.
        act(() => {
          mockInfiniteState.isFetching = true;
        });
        rerender();

        act(() => {
          store.dispatch(playlistSearchSlice.actions.setSort("artist"));
        });
        rerender();

        await waitFor(() =>
          expect(lastQueryArg).toEqual(
            expect.objectContaining({ q: "abc", sort: "artist" }),
          ),
        );
      });
    });
  });
});
