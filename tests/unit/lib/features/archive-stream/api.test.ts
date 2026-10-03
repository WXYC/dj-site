import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpResponse } from "msw";
import type { FlowsheetRangeResponse } from "@wxyc/shared";
import {
  archiveStreamApi,
  useGetArchiveStreamInfiniteQuery,
  MAX_WINDOWS_PER_PAGE,
  type ArchiveStreamCursor,
} from "@/lib/features/archive-stream/api";
import { describeApi } from "@/tests/helpers/api-harness";
import {
  rangeEntry,
  archiveStreamStore,
  serveArchive,
  queueRangeResponses,
  EMPTY_PAGE,
  MAX_WINDOW_MS,
  type RangeWindow,
} from "@/tests/fakes/flowsheetRange";
import { V2_ENTRY_FACTORIES_BY_TYPE } from "@/tests/fixtures/fixtures";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-26T16:00:00.000Z");

const json = (page: FlowsheetRangeResponse) => () => HttpResponse.json(page);

/** `from` other than "now" walks from a fixed cursor, as every page after the head does. */
async function fetchFirstPage(pageSize: number, from: ArchiveStreamCursor = "now") {
  const store = archiveStreamStore();
  const result = await store.dispatch(
    archiveStreamApi.endpoints.getArchiveStream.initiate(
      { pageSize },
      { initialPageParam: from },
    ),
  );
  return { store, result, page: result.data?.pages[0] };
}

const widthsInDays = (windows: RangeWindow[]) => windows.map((w) => (w.end - w.start) / DAY_MS);

describe("archiveStreamApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describeApi(archiveStreamApi, {
    queries: ["getArchiveStream"],
    reducerPath: "archiveStreamApi",
  });

  it("exports the useGetArchiveStreamInfiniteQuery hook", () => {
    expect(typeof useGetArchiveStreamInfiniteQuery).toBe("function");
  });

  it("anchors the head page on the present and starts each later page exactly where the last one stopped", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const boundary = NOW - DAY_MS;
    // The row on the boundary belongs to the head page (its window's start is
    // inclusive); the row a millisecond below it belongs to the next page.
    // Starting the next page a millisecond late re-serves the first, and a
    // millisecond early skips the second -- and dedup is per page, so neither
    // is caught anywhere else.
    const windows = serveArchive([
      // Logged after the device's clock reads, as when that clock runs slow.
      { id: 4, at: NOW + 5 * 60_000 },
      { id: 3, at: NOW - 60_000 },
      { id: 2, at: boundary },
      { id: 1, at: boundary - 1 },
    ]);

    const { store, page } = await fetchFirstPage(2);
    expect(windows[0]).toMatchObject({ start: boundary, end: NOW + DAY_MS });
    expect(page?.nextCursor).toBe(boundary);

    const headWindows = windows.length;
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate(
        { pageSize: 2 },
        { direction: "forward" },
      ),
    );

    expect(windows[headWindows].end).toBe(boundary);
    expect(result.data?.pageParams).toEqual(["now", boundary]);
    expect(result.data?.pages.flatMap((p) => p.entries.map((e) => e.id))).toEqual([4, 3, 2, 1]);
  });

  it("reads newest first across consecutive pages, ties on add_time broken by id", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const HOUR_MS = 60 * 60 * 1000;
    // Ids deliberately disagree with time order, so only (add_time, id) sorts these.
    serveArchive([
      { id: 21, at: NOW - HOUR_MS },
      { id: 24, at: NOW - HOUR_MS },
      { id: 30, at: NOW - 2 * HOUR_MS },
      { id: 3, at: NOW - DAY_MS - HOUR_MS / 2 },
      { id: 1, at: NOW - DAY_MS - HOUR_MS },
      { id: 2, at: NOW - DAY_MS - HOUR_MS },
    ]);

    const { store } = await fetchFirstPage(3);
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate(
        { pageSize: 3 },
        { direction: "forward" },
      ),
    );

    // Flattened the way an infinite listing renders pages: in page order.
    const stream = result.data!.pages.flatMap((p) => p.entries);
    expect(result.data?.pages).toHaveLength(2);
    expect(stream).toHaveLength(6);
    for (let i = 1; i < stream.length; i++) {
      const newer = Date.parse(stream[i - 1].add_time!);
      const older = Date.parse(stream[i].add_time!);
      expect(older < newer || (older === newer && stream[i].id < stream[i - 1].id)).toBe(true);
    }
  });

  it("re-anchors the head page on the present when the walk is refetched", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(NOW);
    const windows = serveArchive([{ id: 1, at: NOW - 60_000 }]);

    const store = archiveStreamStore();
    const subscription = store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({ pageSize: 1 }),
    );
    await subscription;

    now.mockReturnValue(NOW + DAY_MS);
    await subscription.refetch();

    expect(windows.map((w) => w.start)).toEqual([NOW - DAY_MS, NOW, NOW - 2 * DAY_MS]);
    subscription.unsubscribe();
    // Nothing outlives the last subscriber, so a returning listener starts from a fresh head.
    await vi.waitFor(() => expect(store.getState()[archiveStreamApi.reducerPath].queries).toEqual({}));
  });

  it("requests contiguous integer epoch-millisecond windows no wider than the 8-day cap", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const windows = serveArchive([]);

    await fetchFirstPage(5);

    for (const { start, end, params } of windows) {
      expect(params.get("start")).toMatch(/^\d+$/);
      expect(params.get("end")).toMatch(/^\d+$/);
      expect(end - start).toBeGreaterThan(0);
      expect(end - start).toBeLessThanOrEqual(MAX_WINDOW_MS);
    }
    // A gap between steps would skip rows; an overlap would re-walk them.
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].end).toBe(windows[i - 1].start);
    }
  });

  it("serves every entry type in window order, not input or id order", async () => {
    const HOUR_MS = 60 * 60 * 1000;
    const hoursAgo = (h: number) => new Date(NOW - h * HOUR_MS).toISOString();

    // Ids deliberately disagree with add_time order (neither ascending nor
    // descending alongside it), so only (add_time, id) sorts these correctly.
    // Keyed by the contract's enum, so a new entry type cannot be left out.
    const placement = {
      track: { id: 50, hoursAgo: 20 },
      show_start: { id: 10, hoursAgo: 17 },
      show_end: { id: 70, hoursAgo: 14 },
      dj_join: { id: 30, hoursAgo: 11 },
      dj_leave: { id: 90, hoursAgo: 8 },
      talkset: { id: 20, hoursAgo: 5 },
      breakpoint: { id: 60, hoursAgo: 2 },
      message: { id: 40, hoursAgo: 1 },
    } satisfies Record<FlowsheetEntryType, { id: number; hoursAgo: number }>;
    const entries = Object.values(FlowsheetEntryType).map((entryType) =>
      V2_ENTRY_FACTORIES_BY_TYPE[entryType]({
        id: placement[entryType].id,
        add_time: hoursAgo(placement[entryType].hoursAgo),
      })
    );
    // Older than the walked window ([NOW - DAY_MS, NOW)): must not be served.
    const beforeWindow = V2_ENTRY_FACTORIES_BY_TYPE.track({ id: 5, add_time: hoursAgo(25) });

    // Passed in id order, which disagrees with time order, so neither input
    // order nor id order can stand in for it.
    serveArchive([beforeWindow, ...[...entries].sort((a, b) => a.id - b.id)]);

    const { page } = await fetchFirstPage(entries.length, NOW);

    expect(page?.entries).toEqual(
      [...entries].sort((a, b) => b.add_time.localeCompare(a.add_time))
    );
    expect(page?.entries.some((e) => e.id === beforeWindow.id)).toBe(false);
  });

  it("crosses a 42-day gap -- longer than the archive's longest, spring 2020's 41.7 days -- inside one page", async () => {
    const afterGap = NOW - DAY_MS / 2;
    const beforeGap = afterGap - 42 * DAY_MS;
    const windows = serveArchive([
      { id: 1, at: beforeGap },
      { id: 2, at: afterGap },
    ]);

    const { page } = await fetchFirstPage(2, NOW);

    expect(page?.entries.map((e) => e.id)).toEqual([2, 1]);
    expect(page?.reachedStart).toBe(false);
    // Empty windows double up to the 8-day cap.
    expect(widthsInDays(windows)).toEqual([1, 1, 2, 4, 8, 8, 8, 8, 8]);
  });

  it("drops back to one-day windows once a gap gives way to rows", async () => {
    const windows = serveArchive([
      { id: 2, at: NOW - 3 * DAY_MS },
      { id: 1, at: NOW - 3.5 * DAY_MS },
    ]);

    const { page } = await fetchFirstPage(2, NOW);

    expect(page?.entries.map((e) => e.id)).toEqual([2, 1]);
    // A wide window that finds rows is followed by a narrow one, so the rest
    // of a busy stretch isn't pulled in a week at a time.
    expect(widthsInDays(windows)).toEqual([1, 2, 1]);
  });

  it("walks back to the archive's first row, logged the evening of 2004-11-03, and reports reachedStart there", async () => {
    const firstRow = Date.parse("2004-11-04T03:06:41.391Z");
    const windows = serveArchive([
      { id: 154, at: firstRow },
      { id: 155, at: firstRow + 20 * DAY_MS },
    ]);

    const { page } = await fetchFirstPage(50, firstRow + 30 * DAY_MS);

    expect(page?.entries.map((e) => e.id)).toEqual([155, 154]);
    expect(page?.reachedStart).toBe(true);
    expect(page?.nextCursor).toBeNull();
    // Nothing older exists, so nothing older is asked for: the last window is
    // clamped to the UTC midnight before that row.
    expect(Math.min(...windows.map((w) => w.start))).toBe(Date.parse("2004-11-04T00:00:00.000Z"));
  });

  it("stops a walk that meets nothing but empty windows at its budget, with a cursor rather than reachedStart", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const windows = serveArchive([]);

    const { page } = await fetchFirstPage(50);

    expect(windows).toHaveLength(MAX_WINDOWS_PER_PAGE);
    expect(page?.entries).toEqual([]);
    expect(page?.reachedStart).toBe(false);
    expect(page?.nextCursor).toBe(windows[windows.length - 1].start);
  });

  it("ends a page whose every window re-serves rows it already has", async () => {
    const windows = queueRangeResponses([json({ shows: [], entries: [rangeEntry(7)] })]);

    const { page } = await fetchFirstPage(2, NOW);

    expect(windows).toHaveLength(MAX_WINDOWS_PER_PAGE);
    expect(page?.entries.map((e) => e.id)).toEqual([7]);
    expect(page?.reachedStart).toBe(false);
    // Nothing new is a gap, however many rows came back.
    expect(widthsInDays(windows.slice(0, 5))).toEqual([1, 1, 2, 4, 8]);
  });

  it.each([0, -1, Number.NaN])(
    "still walks a window, and so still moves the cursor, when pageSize is %s",
    async (pageSize) => {
      const windows = serveArchive([]);

      const { page } = await fetchFirstPage(pageSize, NOW);

      expect(windows).toHaveLength(1);
      expect(page?.nextCursor).toBe(NOW - DAY_MS);
    },
  );

  it("dedupes an entry the server re-sends across an overlapping window boundary", async () => {
    // The row nearest the boundary (id 31) reappears in the older window too.
    queueRangeResponses([
      json({ shows: [], entries: [rangeEntry(31)] }),
      json({ shows: [], entries: [rangeEntry(10), rangeEntry(31)] }),
    ]);

    const { page } = await fetchFirstPage(2);

    expect(page?.entries.map((e) => e.id)).toEqual([31, 10]);
  });

  const GATEWAY_PAGE = "<!DOCTYPE html><html></html>";

  it.each([
    [
      "an unparseable body",
      () =>
        new HttpResponse(GATEWAY_PAGE, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      200,
      GATEWAY_PAGE,
    ],
    ["a zero-length 200", () => new HttpResponse(null, { status: 200 }), 200, ""],
    ["a 204", () => new HttpResponse(null, { status: 204 }), 204, ""],
  ])(
    "fails the page on %s instead of reading it as an empty window",
    async (_label, body, originalStatus, data) => {
      queueRangeResponses([json(EMPTY_PAGE), body]);

      const { result } = await fetchFirstPage(1);

      // The body travels with the error, so a report says what the hop sent.
      expect(result.error).toMatchObject({ status: "PARSING_ERROR", originalStatus, data });
    },
  );

  it("propagates a genuine backend error instead of masking it as an empty window", async () => {
    queueRangeResponses([
      () => HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
    ]);

    const { result } = await fetchFirstPage(1);

    expect(result.isError).toBe(true);
  });
});
