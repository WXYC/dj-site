import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/store";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";
import type { PlaylistSearchResult } from "@wxyc/shared";

const mockFetchNextPage = vi.fn();
const mockRefetch = vi.fn();

type MockPage = { results: { id: number }[]; total: number; nextCursor?: string };
type MockQueryArg = { q?: string; limit?: number; sort?: string; order?: string };

let lastQueryArg: MockQueryArg | undefined;
let lastSkip = false;
// Every key the hook asked for, oldest first: a key that was in effect for a
// single render is invisible to `lastQueryArg`.
const queryArgLog: MockQueryArg[] = [];

// Mutable canned result for the infinite query. `data.pages` is the RTK page
// array the hook flattens; hasNextPage is RTK's projection of nextCursor via
// getNextPageParam.
const mockInfiniteState = {
  data: undefined as { pages: MockPage[] } | undefined,
  // The current key's own data. `null` stands for "same as data": RTK keeps
  // `data` from the last key that answered and `currentData` from this one.
  currentData: null as { pages: MockPage[] } | undefined | null,
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
      options?: { skip?: boolean },
    ) => {
      lastQueryArg = queryArg;
      lastSkip = options?.skip ?? false;
      queryArgLog.push(queryArg);
      if (options?.skip) {
        return {
          data: undefined,
          currentData: undefined,
          isFetching: false,
          isError: false,
          hasNextPage: false,
          fetchNextPage: mockFetchNextPage,
          refetch: mockRefetch,
        };
      }
      return {
        ...mockInfiniteState,
        currentData:
          mockInfiniteState.currentData === null
            ? mockInfiniteState.data
            : mockInfiniteState.currentData,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      };
    },
  };
});

import {
  usePlaylistSearch,
  usePlaylistSearchControls,
  usePlaylistSearchResults,
  isDefaultQuery,
  isRealQuery,
  shouldShowResults,
  isChronologicalMode,
} from "@/src/hooks/playlistSearchHooks";

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
  mockRefetch.mockReset();
  lastQueryArg = undefined;
  lastSkip = false;
  queryArgLog.length = 0;
  mockInfiniteState.data = undefined;
  mockInfiniteState.currentData = null;
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

  describe("removing a row", () => {
    const BOTH_ROWS = "stereolab AND artist:jessica pratt";

    /** Two filled rows, in place before the hook mounts so nothing is pending. */
    function seedTwoRows(store: AppStore): [string, string] {
      store.dispatch(playlistSearchSlice.actions.addRow());
      const [first, second] = store.getState().playlistSearch.rows;
      store.dispatch(
        playlistSearchSlice.actions.updateRow({
          id: first.id,
          updates: { value: "stereolab" },
        }),
      );
      store.dispatch(
        playlistSearchSlice.actions.updateRow({
          id: second.id,
          updates: { value: "jessica pratt" },
        }),
      );
      return [first.id, second.id];
    }

    // Asserted in the same tick as the removal, with no wait: a removal that
    // sat out the typing delay would still read the two-row query here.
    it.each([
      { removed: "first", index: 0, remaining: "artist:jessica pratt" },
      { removed: "second", index: 1, remaining: "stereolab" },
    ])(
      "applies the remaining query at once when the $removed row goes",
      ({ index, remaining }) => {
        const { store, wrapper } = createWrapper();
        const ids = seedTwoRows(store);

        const { result } = renderHook(() => usePlaylistSearch(), { wrapper });
        expect(result.current.effectiveQuery).toBe(BOTH_ROWS);

        act(() => {
          result.current.removeRow(ids[index]);
        });

        expect(result.current.effectiveQuery).toBe(remaining);
        expect(lastQueryArg?.q).toBe(remaining);
      },
    );

    it("keeps the remaining query in effect while a keystroke after the removal settles", async () => {
      const { store, wrapper } = createWrapper();
      const [first, second] = seedTwoRows(store);

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      act(() => {
        result.current.removeRow(first);
      });
      queryArgLog.length = 0;
      act(() => {
        result.current.updateRow(second, { value: "jessica p" });
      });

      expect(result.current.effectiveQuery).toBe("artist:jessica pratt");
      await waitFor(() =>
        expect(result.current.effectiveQuery).toBe("artist:jessica p"),
      );
      expect(queryArgLog.map((arg) => arg.q)).not.toContain(BOTH_ROWS);
    });

    it("leaves a pending keystroke waiting when a row is added", async () => {
      const { store, wrapper } = createWrapper();
      const rowId = store.getState().playlistSearch.rows[0].id;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

      act(() => {
        result.current.updateRow(rowId, { value: "stereolab" });
      });
      act(() => {
        result.current.addRow();
      });

      expect(result.current.effectiveQuery).toBe("");
      await waitFor(() =>
        expect(result.current.effectiveQuery).toBe("stereolab"),
      );
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

  describe("retry", () => {
    it("refetches when the first page failed and no page is held", async () => {
      const { wrapper } = createWrapper();
      mockInfiniteState.data = undefined;
      mockInfiniteState.isError = true;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      act(() => {
        result.current.retry();
      });

      expect(mockRefetch).toHaveBeenCalledTimes(1);
      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it("fetches the next page when a later page failed and a page is held", async () => {
      const { wrapper } = createWrapper();
      mockInfiniteState.data = { pages: [{ results: [{ id: 1 }], total: 1 }] };
      mockInfiniteState.isError = true;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      act(() => {
        result.current.retry();
      });

      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it("refetches when a new key's first page failed while the previous key's pages are still held", async () => {
      const { wrapper } = createWrapper();
      mockInfiniteState.data = { pages: [{ results: [{ id: 1 }], total: 1 }] };
      mockInfiniteState.currentData = undefined;
      mockInfiniteState.isError = true;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      act(() => {
        result.current.retry();
      });

      expect(mockRefetch).toHaveBeenCalledTimes(1);
      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it("drops a held retry when the search changes before it settles", async () => {
      const { wrapper } = createWrapper();
      mockInfiniteState.data = undefined;
      mockInfiniteState.isError = true;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));

      act(() => {
        result.current.retry();
      });
      expect(result.current.isRetrying).toBe(true);

      mockInfiniteState.isError = false;
      act(() => {
        result.current.setSort({ sortBy: "artist", sortOrder: "asc" });
      });

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.failedPage).toBeNull();
    });

    it("does nothing when nothing has failed", async () => {
      const { wrapper } = createWrapper();
      mockInfiniteState.data = { pages: [{ results: [{ id: 1 }], total: 1 }] };
      mockInfiniteState.isError = false;

      const { result } = renderHook(() => usePlaylistSearch(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(false));

      act(() => {
        result.current.retry();
      });

      expect(mockRefetch).not.toHaveBeenCalled();
      expect(mockFetchNextPage).not.toHaveBeenCalled();
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
          store.dispatch(
            playlistSearchSlice.actions.setSort({
              sortBy: "artist",
              sortOrder: "desc",
            }),
          );
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

describe("controls/key debounce isolation", () => {
  // The hook's documented debounce; not exported, so pinned here as the value
  // that identifies a search debounce timer among any other setTimeout calls
  // a render may produce.
  const SEARCH_DEBOUNCE_MS = 300;

  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setTimeoutSpy = vi.spyOn(global, "setTimeout");
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  function countDebounceTimersArmed(): number {
    return setTimeoutSpy.mock.calls.filter(
      (call: unknown[]) => call[1] === SEARCH_DEBOUNCE_MS,
    ).length;
  }

  it("usePlaylistSearchControls alone arms no debounce timer, on mount or on a query change", () => {
    const { store, wrapper } = createWrapper();
    const rowId = store.getState().playlistSearch.rows[0].id;

    renderHook(() => usePlaylistSearchControls(), { wrapper });
    expect(countDebounceTimersArmed()).toBe(0);

    act(() => {
      store.dispatch(
        playlistSearchSlice.actions.updateRow({
          id: rowId,
          updates: { value: "autechre" },
        }),
      );
    });

    expect(countDebounceTimersArmed()).toBe(0);
  });

  it("usePlaylistSearch arms one debounce timer on mount and one more per query change", () => {
    const { store, wrapper } = createWrapper();
    const rowId = store.getState().playlistSearch.rows[0].id;

    renderHook(() => usePlaylistSearch(), { wrapper });

    act(() => {
      store.dispatch(
        playlistSearchSlice.actions.updateRow({
          id: rowId,
          updates: { value: "autechre" },
        }),
      );
    });

    // One debounce instance arms once on mount and once more when the query
    // changes. Reading the controls' rows/sort through the slice directly
    // (rather than through a second `usePlaylistSearchKey`) keeps that at a
    // single instance, so a mount plus one change arms exactly two timers.
    expect(countDebounceTimersArmed()).toBe(2);
  });
});

describe("query-shape predicates", () => {
  it.each([
    { q: "", expected: true, why: "the empty query is the recent-playlists default" },
    { q: "a", expected: false, why: "a sub-threshold partial is the one skipped state" },
    { q: "au", expected: true, why: "two characters reaches MIN_QUERY_LENGTH" },
    { q: "juana molina", expected: true, why: "an ordinary search" },
  ])("shouldShowResults($q) is $expected because $why", ({ q, expected }) => {
    expect(shouldShowResults(q)).toBe(expected);
  });

  it.each([
    { q: "", isDefault: true, isReal: false },
    { q: "a", isDefault: false, isReal: false },
    { q: "au", isDefault: false, isReal: true },
  ])("classifies $q", ({ q, isDefault, isReal }) => {
    expect(isDefaultQuery(q)).toBe(isDefault);
    expect(isRealQuery(q)).toBe(isReal);
  });

  it.each([
    { q: "", sortBy: "date", sortOrder: "desc", expected: true, why: "the chronological listing itself" },
    { q: "", sortBy: "artist", sortOrder: "desc", expected: false, why: "the default query in a different sort" },
    { q: "", sortBy: "date", sortOrder: "asc", expected: false, why: "oldest first is not the listing" },
    { q: "au", sortBy: "date", sortOrder: "desc", expected: false, why: "a real query is a search, not the listing" },
    { q: "a", sortBy: "date", sortOrder: "desc", expected: false, why: "a sub-threshold partial is not the empty query" },
  ] as const)(
    "isChronologicalMode($q, $sortBy, $sortOrder) is $expected because $why",
    ({ q, sortBy, sortOrder, expected }) => {
      expect(isChronologicalMode(q, sortBy, sortOrder)).toBe(expected);
    },
  );
});

describe("usePlaylistSearchResults", () => {
  const seedRow = { id: 900, artist_name: "Chuquimamani-Condori" };
  const liveRow = { id: 1, artist_name: "Juana Molina" };
  const seed = [seedRow] as unknown as PlaylistSearchResult[];

  it("shows the server seed for the default query before the client query answers", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => usePlaylistSearchResults({ initialResults: seed }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.showResults).toBe(true));
    expect(result.current.displayResults.map((r) => r.id)).toEqual([900]);
  });

  it("shows results for the default query with no seed supplied", async () => {
    const { wrapper } = createWrapper();
    mockInfiniteState.data = { pages: [{ results: [liveRow], total: 1 }] };

    const { result } = renderHook(() => usePlaylistSearchResults(), { wrapper });

    await waitFor(() => expect(result.current.displayResults).toHaveLength(1));
    expect(result.current.showResults).toBe(true);
    expect(result.current.isRealQuery).toBe(false);
  });

  it("hides results only for a sub-threshold partial", async () => {
    const { store, wrapper } = createWrapper();
    const rowId = store.getState().playlistSearch.rows[0].id;

    const { result } = renderHook(() => usePlaylistSearchResults(), { wrapper });
    await waitFor(() => expect(result.current.showResults).toBe(true));

    act(() => {
      store.dispatch(
        playlistSearchSlice.actions.updateRow({
          id: rowId,
          updates: { value: "a" },
        }),
      );
    });

    await waitFor(() => expect(result.current.showResults).toBe(false));
  });

  it("retires the seed permanently once the client query answers", async () => {
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      () => usePlaylistSearchResults({ initialResults: seed }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.displayResults[0].id).toBe(900));

    act(() => {
      mockInfiniteState.data = { pages: [{ results: [liveRow], total: 1 }] };
    });
    rerender();
    await waitFor(() => expect(result.current.displayResults[0].id).toBe(1));

    // A sort change re-keys the RTK cache and empties results mid-flight.
    // Resurfacing the seed here would flash rows in the server's order over
    // the sort the user just chose.
    act(() => {
      mockInfiniteState.data = undefined;
    });
    rerender();

    expect(result.current.displayResults).toEqual([]);
  });

  it("retires the seed when the default listing answers with no rows", async () => {
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      () => usePlaylistSearchResults({ initialResults: seed }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.displayResults[0].id).toBe(900));

    // An empty listing is still an answer. Keyed on row count instead of on
    // the query settling, the seed would stand on screen contradicting it for
    // the life of the page.
    act(() => {
      mockInfiniteState.data = { pages: [{ results: [], total: 0 }] };
    });
    rerender();

    expect(result.current.displayResults).toEqual([]);
  });

  it("retires the seed when the client query errors", async () => {
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      () => usePlaylistSearchResults({ initialResults: seed }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.displayResults[0].id).toBe(900));

    act(() => {
      mockInfiniteState.isError = true;
    });
    rerender();

    expect(result.current.displayResults).toEqual([]);
  });
});

describe("sort controls", () => {
  it("carries the chosen field and direction into the query key", async () => {
    const { store, wrapper } = createWrapper();
    const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

    act(() => {
      result.current.setSort({ sortBy: "artist", sortOrder: "asc" });
    });

    expect(store.getState().playlistSearch).toMatchObject({
      sortBy: "artist",
      sortOrder: "asc",
    });
    await waitFor(() =>
      expect(lastQueryArg).toEqual(
        expect.objectContaining({ sort: "artist", order: "asc" }),
      ),
    );
  });

  it("leaves the column header a direction toggle", () => {
    const { store, wrapper } = createWrapper();
    const { result } = renderHook(() => usePlaylistSearch(), { wrapper });

    act(() => {
      result.current.handleSort("date");
    });
    expect(store.getState().playlistSearch.sortOrder).toBe("asc");

    act(() => {
      result.current.handleSort("date");
    });
    expect(store.getState().playlistSearch.sortOrder).toBe("desc");
  });
});
