import { describe, it, expect, vi, afterEach } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";
import { createElement, useEffect, type ReactNode } from "react";
import { Provider } from "react-redux";
import { HttpResponse } from "msw";
import type { FlowsheetRangeResponse, FlowsheetV2Entry } from "@wxyc/shared";
import {
  useArchiveStreamListing,
  useArchiveStreamSubscription,
} from "@/src/hooks/archiveStreamHooks";
import {
  archiveStreamStore,
  rangeEntry,
  queueRangeResponses,
  type RangeWindow,
} from "@/tests/fakes/flowsheetRange";

const NOW = Date.parse("2026-09-26T16:00:00.000Z");
const PAGE_SIZE = 50;

const json = (page: FlowsheetRangeResponse) => () => HttpResponse.json(page);
const errorResponse = () =>
  HttpResponse.json({ message: "window read failed" }, { status: 500 });

/** Oldest first within the batch, matching the wire's own order. */
function syntheticEntries(startId: number, count: number): FlowsheetV2Entry[] {
  return Array.from({ length: count }, (_, i) => rangeEntry(startId + i, i));
}

const descendingIds = (from: number, to: number) =>
  Array.from({ length: from - to + 1 }, (_, i) => from - i);

function createWrapper() {
  const store = archiveStreamStore();
  return {
    store,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(Provider, { store, children }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useArchiveStreamListing", () => {
  it("flattens pages in page order, newest first, dropping a repeated id", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    // Page 1 and page 2 each carry exactly PAGE_SIZE entries, so each page's
    // walk stops after its first window regardless of real archive density --
    // and id 50 is deliberately repeated across them, the one way a listing
    // built from `data.pages` could ever see the same row twice.
    queueRangeResponses([
      json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
      json({ shows: [], entries: syntheticEntries(50, PAGE_SIZE) }),
    ]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveStreamListing(), { wrapper });

    await waitFor(() =>
      expect(result.current.rows.map((r) => r.id)).toEqual(descendingIds(50, 1)),
    );
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadNextPage());

    await waitFor(() =>
      expect(result.current.rows.map((r) => r.id)).toEqual([
        ...descendingIds(50, 1),
        ...descendingIds(99, 51),
      ]),
    );
  });

  it("keeps a row's object identity across an appended page", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    queueRangeResponses([
      json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
      json({ shows: [], entries: syntheticEntries(1000, PAGE_SIZE) }),
    ]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveStreamListing(), { wrapper });

    await waitFor(() => expect(result.current.rows).toHaveLength(PAGE_SIZE));
    const firstPageRows = result.current.rows;

    act(() => result.current.loadNextPage());

    await waitFor(() =>
      expect(result.current.rows).toHaveLength(PAGE_SIZE * 2),
    );
    // The append carries page 1's entry objects over, and the row conversion
    // is cached on the entry object, so page 1's rows come through as the
    // same objects instead of being rebuilt from `data.pages`.
    firstPageRows.forEach((row, i) => {
      expect(result.current.rows[i]).toBe(row);
    });
  });

  it("tracks isHeadLoading across an initial fetch, a head failure, a retry, and a next-page fetch", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const DELAY_MS = 100;
    queueRangeResponses(
      [
        errorResponse,
        json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
        json({ shows: [], entries: syntheticEntries(1000, PAGE_SIZE) }),
      ],
      { delayMs: DELAY_MS },
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveStreamListing(), { wrapper });

    // On first mount, the head fetch is in flight.
    await waitFor(() => expect(result.current.isHeadLoading).toBe(true));
    await waitFor(() => expect(result.current.headFailed).toBe(true));
    expect(result.current.isHeadLoading).toBe(false);

    act(() => result.current.retry());
    // During the retry -- a fetch that follows an error -- isHeadLoading
    // must rise again; RTK's own `isLoading` never does.
    await waitFor(() => expect(result.current.isHeadLoading).toBe(true));
    await waitFor(() => expect(result.current.isHeadLoading).toBe(false));
    expect(result.current.headFailed).toBe(false);
    expect(result.current.isNextPageLoading).toBe(false);

    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.isNextPageLoading).toBe(true));
    expect(result.current.isHeadLoading).toBe(false);
    await waitFor(() => expect(result.current.isNextPageLoading).toBe(false));
  });

  it("keeps hasAnswered true while a head retry is in flight", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const DELAY_MS = 100;
    queueRangeResponses([errorResponse, errorResponse], { delayMs: DELAY_MS });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveStreamListing(), { wrapper });

    await waitFor(() => expect(result.current.hasAnswered).toBe(true));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.isHeadLoading).toBe(true));
    // The live expression (`data !== undefined || isError`) would read false
    // here: the retry's `pending` state has already cleared `isError`, and no
    // page has ever landed to supply `data`.
    expect(result.current.hasAnswered).toBe(true);

    await waitFor(() => expect(result.current.isHeadLoading).toBe(false));
    expect(result.current.hasAnswered).toBe(true);
  });

  it("is a no-op after a failed next page until retry is called, which re-requests only the failed page's own window", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const windows: RangeWindow[] = queueRangeResponses([
      json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
      errorResponse,
    ]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveStreamListing(), { wrapper });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    const firstPageRows = result.current.rows;
    expect(firstPageRows).toHaveLength(PAGE_SIZE);

    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.nextPageFailed).toBe(true));
    expect(windows).toHaveLength(2);
    // A rejected page is never appended, so the rows fetched before it and
    // the walk's ability to continue both survive the failure untouched.
    expect(result.current.rows).toBe(firstPageRows);
    expect(result.current.hasMore).toBe(true);

    // A scroll sentinel re-firing on every render must not re-dispatch the
    // request this already failed -- that is what makes a broken page an
    // unthrottled retry loop rather than a stall. The extra calls are real
    // async dispatches if the gate is missing, so this gives any wrongly
    // fired request a real tick to land before asserting it didn't.
    for (let i = 0; i < 5; i++) act(() => result.current.loadNextPage());
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(windows).toHaveLength(2);
    expect(result.current.rows).toBe(firstPageRows);
    expect(result.current.hasMore).toBe(true);

    const failedWindow = windows[1];
    act(() => result.current.retry());
    act(() => result.current.retry());
    await waitFor(() => expect(windows).toHaveLength(3));
    // A second unthrottled dispatch is a real async call, not a synchronous
    // one -- give it a real tick to land before trusting the count has
    // settled at exactly one added request.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(windows).toHaveLength(3);
    expect(windows[2]).toMatchObject({
      start: failedWindow.start,
      end: failedWindow.end,
    });
  });

  // A request starts with a `pending` action dispatched inside the call that
  // starts it, so a store left holding the same state object is a store no
  // request was started against.
  it("starts no request when retry is called with pages loaded and nothing failed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    queueRangeResponses([
      json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
      json({ shows: [], entries: syntheticEntries(1000, PAGE_SIZE) }),
    ]);
    const { store, wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveStreamListing(), { wrapper });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    expect(result.current.rows).toHaveLength(PAGE_SIZE);
    expect(result.current.headFailed).toBe(false);
    expect(result.current.nextPageFailed).toBe(false);

    const loaded = store.getState();
    act(() => result.current.retry());
    expect(store.getState()).toBe(loaded);
  });

  it("starts no request when a retry returned before anything had answered is called after the head has failed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    queueRangeResponses([errorResponse, errorResponse]);
    const { store, wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveStreamListing(), { wrapper });
    expect(result.current.hasAnswered).toBe(false);
    const retryFromBeforeAnyAnswer = result.current.retry;
    await waitFor(() => expect(result.current.headFailed).toBe(true));

    const failed = store.getState();
    act(() => retryFromBeforeAnyAnswer());
    expect(store.getState()).toBe(failed);
  });

  // Not run at 0 ms: RTK holds the store notification for a request's pending
  // action until the next animation frame, and a response that lands before
  // that frame is covered by the same notification, so the pending state is
  // never rendered.
  describe.each([20, 120])(
    "retry routing while a head retry is in flight, at a %dms fake delay",
    (delayMs) => {
      it("retries a head failure by re-requesting the head, without ever rendering isNextPageLoading true", async () => {
        vi.spyOn(Date, "now").mockReturnValue(NOW);
        const windows = queueRangeResponses([errorResponse, errorResponse], {
          delayMs,
        });
        const { wrapper } = createWrapper();
        // Every render's value, not just the settled one: both a correct and
        // a `fetchNextPage()`-routed retry read `isNextPageLoading: false`
        // once settled (finding this requires catching it mid-flight).
        const nextPageLoadingSeen: boolean[] = [];
        const { result } = renderHook(
          () => {
            const listing = useArchiveStreamListing();
            nextPageLoadingSeen.push(listing.isNextPageLoading);
            return listing;
          },
          { wrapper },
        );

        await waitFor(() => expect(result.current.headFailed).toBe(true));
        const headWindow = windows[0];
        nextPageLoadingSeen.length = 0;

        act(() => result.current.retry());
        await waitFor(() => expect(windows).toHaveLength(2));
        await act(
          () => new Promise((resolve) => setTimeout(resolve, delayMs + 40)),
        );

        expect(nextPageLoadingSeen).not.toContain(true);
        expect(windows[1]).toMatchObject({
          start: headWindow.start,
          end: headWindow.end,
        });
      });
    },
  );

  describe.each([0, 20, 120])(
    "head vs. next-page failure classification and retry routing, at a %dms fake delay",
    (delayMs) => {
      it("classifies a head failure that also fails on retry as a head failure, not a next-page failure", async () => {
        vi.spyOn(Date, "now").mockReturnValue(NOW);
        const windows = queueRangeResponses([errorResponse, errorResponse], {
          delayMs,
        });
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useArchiveStreamListing(), {
          wrapper,
        });

        await waitFor(() => expect(result.current.headFailed).toBe(true));
        expect(result.current.nextPageFailed).toBe(false);

        act(() => result.current.retry());
        // `headFailed` reads true on both sides of this retry, so no flag
        // transition marks its end; the fake having sent the retry's
        // response does.
        await waitFor(() => expect(windows[1]?.answered).toBe(true));
        await waitFor(() => {
          expect(result.current.headFailed).toBe(true);
          expect(result.current.nextPageFailed).toBe(false);
        });
        expect(result.current.rows).toEqual([]);
      });

      it("classifies a next-page failure as a next-page failure, not a head failure, with the earlier rows intact", async () => {
        vi.spyOn(Date, "now").mockReturnValue(NOW);
        queueRangeResponses(
          [json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }), errorResponse],
          { delayMs },
        );
        const { wrapper } = createWrapper();

        const { result } = renderHook(() => useArchiveStreamListing(), {
          wrapper,
        });
        await waitFor(() => expect(result.current.hasMore).toBe(true));

        act(() => result.current.loadNextPage());
        // `nextPageFailed` genuinely flips false -> true here (unlike the
        // head-retry case above), so waiting on it is never vacuous.
        await waitFor(() => expect(result.current.nextPageFailed).toBe(true));

        expect(result.current.headFailed).toBe(false);
        expect(result.current.rows).toHaveLength(PAGE_SIZE);
      });

      it("retries a next-page failure by re-requesting only the failed page's own window, not the head's", async () => {
        vi.spyOn(Date, "now").mockReturnValue(NOW);
        const windows = queueRangeResponses(
          [
            json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
            errorResponse,
            errorResponse,
          ],
          { delayMs },
        );
        const { wrapper } = createWrapper();
        const nextPageLoadingSeen: boolean[] = [];
        const { result } = renderHook(
          () => {
            const listing = useArchiveStreamListing();
            nextPageLoadingSeen.push(listing.isNextPageLoading);
            return listing;
          },
          { wrapper },
        );
        await waitFor(() => expect(result.current.hasMore).toBe(true));

        act(() => result.current.loadNextPage());
        await waitFor(() => expect(result.current.nextPageFailed).toBe(true));
        const headWindow = windows[0];
        const failedWindow = windows[1];
        nextPageLoadingSeen.length = 0;

        act(() => result.current.retry());
        await waitFor(() => expect(windows).toHaveLength(3));
        await act(
          () => new Promise((resolve) => setTimeout(resolve, delayMs + 40)),
        );

        // Unlike the head-retry case above, a plain `refetch()` mutant here
        // would re-walk the cached head page too, which this delay alone
        // wouldn't catch -- the window assertions below do.
        if (delayMs > 0) expect(nextPageLoadingSeen).toContain(true);
        expect(windows).toHaveLength(3);
        expect(windows[2]).toMatchObject({
          start: failedWindow.start,
          end: failedWindow.end,
        });
        expect(windows[2]).not.toMatchObject({
          start: headWindow.start,
          end: headWindow.end,
        });
      });
    },
  );

  it("reports hasMore for an empty page that still carries a cursor", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    queueRangeResponses([json({ shows: [], entries: [] })]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveStreamListing(), { wrapper });

    await waitFor(() => expect(result.current.hasAnswered).toBe(true));
    expect(result.current.rows).toEqual([]);
    expect(result.current.hasMore).toBe(true);
  });
});

describe("useArchiveStreamSubscription", () => {
  function Listing({ onRows }: { onRows: (ids: number[]) => void }) {
    const { rows } = useArchiveStreamListing();
    useEffect(() => {
      onRows(rows.map((r) => r.id));
    }, [rows, onRows]);
    return null;
  }

  function WithSubscription({
    listingVisible,
    mountListing,
    onRows,
  }: {
    listingVisible: boolean;
    mountListing: boolean;
    onRows: (ids: number[]) => void;
  }) {
    useArchiveStreamSubscription(listingVisible);
    return mountListing ? createElement(Listing, { onRows }) : null;
  }

  function WithoutSubscription({
    mountListing,
    onRows,
  }: {
    mountListing: boolean;
    onRows: (ids: number[]) => void;
  }) {
    return mountListing ? createElement(Listing, { onRows }) : null;
  }

  it("holds the walk across an unmount and remount of the listing hook", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const windows = queueRangeResponses([
      json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
    ]);
    const { wrapper } = createWrapper();
    let rows: number[] = [];
    const onRows = (ids: number[]) => (rows = ids);

    const { rerender } = render(
      createElement(WithSubscription, { listingVisible: true, mountListing: true, onRows }),
      { wrapper },
    );

    await waitFor(() => expect(rows).toHaveLength(PAGE_SIZE));
    expect(windows).toHaveLength(1);

    rerender(
      createElement(WithSubscription, { listingVisible: true, mountListing: false, onRows }),
    );
    // Gives the `keepUnusedDataFor: 0` GC timer a real tick to run before the
    // remount below, so a pass here proves the subscription hook's own
    // subscription -- not merely a remount landing before GC fired.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    rows = [];
    rerender(
      createElement(WithSubscription, { listingVisible: true, mountListing: true, onRows }),
    );

    await waitFor(() => expect(rows).toHaveLength(PAGE_SIZE));
    expect(windows).toHaveLength(1);
  });

  it("holds the walk across the visibility dip the real caller produces: visible, unmounted and not visible, then visible again", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const windows = queueRangeResponses([
      json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
    ]);
    const { wrapper } = createWrapper();
    let rows: number[] = [];
    const onRows = (ids: number[]) => (rows = ids);

    const { rerender } = render(
      createElement(WithSubscription, { listingVisible: true, mountListing: true, onRows }),
      { wrapper },
    );

    await waitFor(() => expect(rows).toHaveLength(PAGE_SIZE));
    expect(windows).toHaveLength(1);

    // The surfaces that drive this compute `listingVisible` from the same
    // branch that unmounts the listing -- opening a show -- so the two go
    // false together, not one while the other stays true.
    rerender(
      createElement(WithSubscription, { listingVisible: false, mountListing: false, onRows }),
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    rows = [];
    rerender(
      createElement(WithSubscription, { listingVisible: true, mountListing: true, onRows }),
    );

    await waitFor(() => expect(rows).toHaveLength(PAGE_SIZE));
    expect(windows).toHaveLength(1);
  });

  it("restarts the walk on remount without the subscription hook", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const windows = queueRangeResponses([
      json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
    ]);
    const { wrapper } = createWrapper();
    let rows: number[] = [];
    const onRows = (ids: number[]) => (rows = ids);

    const { rerender } = render(
      createElement(WithoutSubscription, { mountListing: true, onRows }),
      { wrapper },
    );

    await waitFor(() => expect(rows).toHaveLength(PAGE_SIZE));
    expect(windows).toHaveLength(1);

    rerender(createElement(WithoutSubscription, { mountListing: false, onRows }));
    // `keepUnusedDataFor: 0` still schedules the cache-entry removal via
    // `setTimeout(fn, 0)` rather than dropping it synchronously on unsubscribe,
    // so the next mount has to wait a real tick to land after that GC runs --
    // remounting immediately would find the entry still cached and skip.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    rows = [];
    rerender(createElement(WithoutSubscription, { mountListing: true, onRows }));

    await waitFor(() => expect(windows).toHaveLength(2));
  });

  it("makes no request before the listing has been visible once", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const windows = queueRangeResponses([
      json({ shows: [], entries: syntheticEntries(1, PAGE_SIZE) }),
    ]);
    const { wrapper } = createWrapper();

    const { rerender } = renderHook(
      ({ listingVisible }: { listingVisible: boolean }) =>
        useArchiveStreamSubscription(listingVisible),
      { wrapper, initialProps: { listingVisible: false } },
    );

    // A real tick, not a synchronous check: a wrongly-unconditional
    // subscription would fire its fetch asynchronously, and asserting
    // immediately would pass by racing ahead of that request rather than by
    // the gate actually holding.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(windows).toHaveLength(0);

    rerender({ listingVisible: true });

    await waitFor(() => expect(windows).toHaveLength(1));
  });
});
