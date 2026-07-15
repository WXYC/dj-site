import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/store";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";

const mockTrigger = vi.fn();
const mockQueryState = {
  data: undefined as
    | { results: { id: number }[]; total: number; nextCursor?: string }
    | undefined,
  isFetching: false,
  isError: false,
  // originalArgs mirrors RTK's lazy-query result: the request args that
  // produced the current `data`. The accumulator keys replace-vs-append on
  // originalArgs.cursor, so tests that assert accumulation must set it.
  originalArgs: undefined as
    | { q: string; cursor?: string; sort: string; order: string }
    | undefined,
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

import { usePlaylistSearch } from "./playlistSearchHooks";

function createWrapper(store?: AppStore) {
  const s = store ?? makeStore();
  return {
    store: s,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(Provider, { store: s, children }),
  };
}

beforeEach(() => {
  mockTrigger.mockReset();
  mockQueryState.data = undefined;
  mockQueryState.isFetching = false;
  mockQueryState.isError = false;
  mockQueryState.originalArgs = undefined;
});

describe("usePlaylistSearch", () => {
  describe("default-recent behavior", () => {
    it("fires an empty-query request on mount so the page shows recent tracks", async () => {
      const { wrapper } = createWrapper();

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(mockTrigger).toHaveBeenCalled());
      expect(mockTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ q: "", cursor: undefined }),
      );
    });

    it("re-fires the empty query when the user clears all rows back to default", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      renderHook(() => usePlaylistSearch(), { wrapper });

      // Initial empty fire
      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));

      // User types something
      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "autechre" },
          }),
        );
      });
      await waitFor(() =>
        expect(mockTrigger).toHaveBeenCalledWith(
          expect.objectContaining({ q: "autechre" }),
        ),
      );

      // User clears it
      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "" },
          }),
        );
      });
      await waitFor(() => {
        const lastCall = mockTrigger.mock.calls.at(-1);
        expect(lastCall?.[0]).toEqual(expect.objectContaining({ q: "" }));
      });
    });
  });

  describe("partial-query debounce", () => {
    it("does not fire while the user has typed only a single character", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      renderHook(() => usePlaylistSearch(), { wrapper });

      // Wait for the initial empty fire so we can isolate the next behavior
      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));

      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "a" },
          }),
        );
      });

      // Give effects a tick to settle, then assert no new call
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockTrigger).toHaveBeenCalledTimes(1);
    });

    it("fires once the user types a second character", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));

      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "au" },
          }),
        );
      });

      await waitFor(() =>
        expect(mockTrigger).toHaveBeenCalledWith(
          expect.objectContaining({ q: "au" }),
        ),
      );
    });
  });

  describe("cursor pagination", () => {
    it("hasMore is true when the response includes a nextCursor", async () => {
      const { wrapper } = createWrapper();
      mockQueryState.data = {
        results: [],
        total: 1000,
        nextCursor: "2024-06-15T14:30:00.000Z_42",
      };

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(result.current.hasMore).toBe(true));
    });

    it("hasMore is false when the response has no nextCursor", async () => {
      const { wrapper } = createWrapper();
      mockQueryState.data = { results: [], total: 5 };

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(result.current.hasMore).toBe(false));
    });

    it("loadNextPage advances the cursor to nextCursor and re-fires", async () => {
      const { store, wrapper } = createWrapper();
      mockQueryState.data = {
        results: [{ id: 1 }],
        total: 1000,
        nextCursor: "2024-06-15T14:30:00.000Z_42",
      };

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.loadNextPage();
      });

      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(2));
      expect(mockTrigger.mock.calls[1][0]).toEqual(
        expect.objectContaining({ cursor: "2024-06-15T14:30:00.000Z_42" }),
      );
      expect(store.getState().playlistSearch.cursor).toBe(
        "2024-06-15T14:30:00.000Z_42",
      );
    });

    it("loadNextPage is a no-op when no nextCursor is available", async () => {
      const { wrapper } = createWrapper();
      mockQueryState.data = { results: [{ id: 1 }], total: 1 };

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));

      act(() => {
        result.current.loadNextPage();
      });

      // Wait long enough for any spurious effect to fire
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockTrigger).toHaveBeenCalledTimes(1);
    });

    it("editing a row resets the cursor and refetches from the start", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      // Simulate having paged once already
      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.advanceCursor(
            "2024-06-15T14:30:00.000Z_42",
          ),
        );
      });

      renderHook(() => usePlaylistSearch(), { wrapper });

      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));
      expect(mockTrigger.mock.calls[0][0]).toEqual(
        expect.objectContaining({ cursor: "2024-06-15T14:30:00.000Z_42" }),
      );

      // User edits the search → cursor resets
      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({
            id: rowId,
            updates: { value: "autechre" },
          }),
        );
      });

      await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(2));
      expect(mockTrigger.mock.calls[1][0]).toEqual(
        expect.objectContaining({ q: "autechre", cursor: undefined }),
      );
      expect(store.getState().playlistSearch.cursor).toBeNull();
    });
  });

  // Race-simulation coverage for the async-search hardening (#604, #623).
  describe("async-race hardening", () => {
    describe("#604 — stale accumulator on cursor reset", () => {
      it("does not resurrect the prior query's rows when typing resets the cursor", async () => {
        const { store, wrapper } = createWrapper();
        const rowId = store.getState().playlistSearch.rows[0].id;

        // Paginated state of an OLD query: cursor advanced, and data +
        // originalArgs describe a page produced with a non-null cursor.
        act(() => {
          store.dispatch(
            playlistSearchSlice.actions.advanceCursor("c1"),
          );
        });
        mockQueryState.data = { results: [{ id: 111 }, { id: 222 }], total: 2 };
        mockQueryState.originalArgs = {
          q: "old",
          cursor: "c1",
          sort: "date",
          order: "desc",
        };

        const { result, rerender } = renderHook(() => usePlaylistSearch(), {
          wrapper,
        });
        await waitFor(() =>
          expect(result.current.results.map((r) => r.id)).toEqual([111, 222]),
        );

        // Type a NEW query. updateRow resets the slice cursor to null, but
        // data + originalArgs still hold the OLD query until the new fetch
        // lands. The just-typed query must not flash the old rows.
        act(() => {
          store.dispatch(
            playlistSearchSlice.actions.updateRow({
              id: rowId,
              updates: { value: "new" },
            }),
          );
        });
        rerender();

        await waitFor(() => expect(result.current.results).toEqual([]));
        // Stays cleared across subsequent renders (no delayed stale flash).
        rerender();
        expect(result.current.results).toEqual([]);
      });

      it("still appends the next page for the same query", async () => {
        const { wrapper } = createWrapper();

        // Page 1 of the current query — produced with no cursor (first page).
        mockQueryState.data = {
          results: [{ id: 1 }, { id: 2 }],
          total: 4,
          nextCursor: "c1",
        };
        mockQueryState.originalArgs = {
          q: "",
          cursor: undefined,
          sort: "date",
          order: "desc",
        };
        const { result, rerender } = renderHook(() => usePlaylistSearch(), {
          wrapper,
        });
        await waitFor(() =>
          expect(result.current.results.map((r) => r.id)).toEqual([1, 2]),
        );

        // Load the next page: cursor advances, then page 2 arrives produced
        // with the c1 cursor. Overlapping id 2 is deduped.
        act(() => {
          result.current.loadNextPage();
        });
        mockQueryState.data = { results: [{ id: 2 }, { id: 3 }], total: 4 };
        mockQueryState.originalArgs = {
          q: "",
          cursor: "c1",
          sort: "date",
          order: "desc",
        };
        rerender();

        await waitFor(() =>
          expect(result.current.results.map((r) => r.id)).toEqual([1, 2, 3]),
        );
      });
    });

    // #623 — regression guard on the fire effect's full-tuple paramsChanged
    // comparison. That comparison (query string AND cursor/sortBy/sortOrder,
    // re-run when isFetching flips false) is what carries a mid-flight
    // sort/cursor change into a deferred re-fire; a query-string-only
    // comparison would drop it. This pins the existing guard rather than
    // reproducing a live failure.
    describe("#623 — sort change while a fetch is in flight", () => {
      it("re-fires with the new sort once the in-flight fetch settles", async () => {
        const { store, wrapper } = createWrapper();
        const rowId = store.getState().playlistSearch.rows[0].id;
        const { rerender } = renderHook(() => usePlaylistSearch(), { wrapper });

        // Initial empty-query mount fire.
        await waitFor(() => expect(mockTrigger).toHaveBeenCalledTimes(1));

        // Type a query and let it fire.
        act(() => {
          store.dispatch(
            playlistSearchSlice.actions.updateRow({
              id: rowId,
              updates: { value: "abc" },
            }),
          );
        });
        await waitFor(() =>
          expect(mockTrigger).toHaveBeenLastCalledWith(
            expect.objectContaining({ q: "abc", sort: "date" }),
          ),
        );
        const callsAfterAbc = mockTrigger.mock.calls.length;

        // That abc/date fetch is now slow and in flight.
        act(() => {
          mockQueryState.isFetching = true;
        });
        rerender();

        // User clicks the sort header — query text unchanged, only the sort
        // moves. Nothing new should fire while the request is in flight; the
        // change is picked up by the settle re-run of the fire effect.
        act(() => {
          store.dispatch(playlistSearchSlice.actions.setSort("artist"));
        });
        rerender();
        expect(mockTrigger.mock.calls.length).toBe(callsAfterAbc);

        // The in-flight fetch settles.
        act(() => {
          mockQueryState.isFetching = false;
        });
        rerender();

        // Exactly one re-fire, carrying the new sort.
        await waitFor(() =>
          expect(mockTrigger).toHaveBeenLastCalledWith(
            expect.objectContaining({ q: "abc", sort: "artist" }),
          ),
        );
        expect(mockTrigger.mock.calls.length).toBe(callsAfterAbc + 1);
      });
    });
  });
});
