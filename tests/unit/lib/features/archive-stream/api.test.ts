import { describe, it, expect, vi, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import type { FlowsheetRangeEntry, FlowsheetRangeResponse } from "@wxyc/shared";
import {
  archiveStreamApi,
  useGetArchiveStreamInfiniteQuery,
  MAX_WINDOWS_PER_PAGE,
} from "@/lib/features/archive-stream/api";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { describeApi } from "@/tests/helpers/api-harness";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 8 * DAY_MS;
const EMPTY_PAGE: FlowsheetRangeResponse = { shows: [], entries: [] };
const NOW = Date.parse("2026-09-26T16:00:00.000Z");

/** A requested `/flowsheet/range` window, with the raw params it was sent as. */
type RangeWindow = { start: number; end: number; params: URLSearchParams };

function rangeEntry(id: number, at?: number): FlowsheetRangeEntry {
  return {
    id,
    play_order: id,
    show_id: 1,
    request_flag: false,
    entry_type: "track",
    ...(at === undefined ? {} : { add_time: new Date(at).toISOString() }),
  };
}

function archiveStreamStore() {
  return configureStore({
    reducer: { [archiveStreamApi.reducerPath]: archiveStreamApi.reducer },
    middleware: (gdm) => gdm().concat(archiveStreamApi.middleware),
  });
}

function captureWindow(request: Request, windows: RangeWindow[]): RangeWindow {
  const params = new URL(request.url).searchParams;
  const requested = { start: Number(params.get("start")), end: Number(params.get("end")), params };
  windows.push(requested);
  return requested;
}

/**
 * A fake archive that answers the way the backend does: every row whose
 * `add_time` falls in the half-open window `[start, end)`, oldest first.
 * Returns the requested windows in call order.
 */
function serveArchive(rows: { id: number; at: number }[]): RangeWindow[] {
  const windows: RangeWindow[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/range`, ({ request }) => {
      const { start, end } = captureWindow(request, windows);
      const entries = rows
        .filter((row) => row.at >= start && row.at < end)
        .sort((a, b) => a.at - b.at || a.id - b.id)
        .map((row) => rangeEntry(row.id, row.at));
      return HttpResponse.json({ shows: [], entries });
    }),
  );
  return windows;
}

/**
 * Serves `bodies` in order, one per request, repeating the final one once
 * exhausted. Returns the requested windows in call order.
 */
function queueRangeResponses(bodies: (() => Response)[]): RangeWindow[] {
  const windows: RangeWindow[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/range`, ({ request }) => {
      const body = bodies[Math.min(windows.length, bodies.length - 1)];
      captureWindow(request, windows);
      return body();
    }),
  );
  return windows;
}

const json = (page: FlowsheetRangeResponse) => () => HttpResponse.json(page);

async function fetchFirstPage(pageSize: number) {
  const store = archiveStreamStore();
  const result = await store.dispatch(
    archiveStreamApi.endpoints.getArchiveStream.initiate({ pageSize }),
  );
  return { store, result, page: result.data?.pages[0] };
}

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
      { id: 3, at: NOW - 60_000 },
      { id: 2, at: boundary },
      { id: 1, at: boundary - 1 },
    ]);

    const { store, page } = await fetchFirstPage(2);
    expect(windows[0].end).toBe(NOW);
    expect(page?.nextCursor).toBe(boundary);

    const headWindows = windows.length;
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate(
        { pageSize: 2 },
        { direction: "forward" },
      ),
    );

    expect(windows[headWindows].end).toBe(boundary);
    expect(result.data?.pageParams).toEqual([null, boundary]);
    expect(result.data?.pages.flatMap((p) => p.entries.map((e) => e.id))).toEqual([2, 3, 1]);
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

    expect(windows.map((w) => w.end)).toEqual([NOW, NOW + DAY_MS, NOW]);
    subscription.unsubscribe();
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

  it("crosses a 42-day gap -- longer than the archive's longest, spring 2020's 41.7 days -- inside one page", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const afterGap = NOW - DAY_MS / 2;
    const beforeGap = afterGap - 42 * DAY_MS;
    const windows = serveArchive([
      { id: 1, at: beforeGap },
      { id: 2, at: afterGap },
    ]);

    const { page } = await fetchFirstPage(2);

    expect(page?.entries.map((e) => e.id)).toEqual([1, 2]);
    expect(page?.reachedStart).toBe(false);
    // Empty windows double up to the cap, and a window with rows drops back to
    // one day so a busy stretch never lands a week of rows on one page.
    expect(windows.map((w) => (w.end - w.start) / DAY_MS)).toEqual([1, 1, 2, 4, 8, 8, 8, 8, 8]);
  });

  it("drops back to one-day windows once a gap gives way to rows", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const windows = serveArchive([
      { id: 2, at: NOW - 3 * DAY_MS },
      { id: 1, at: NOW - 3.5 * DAY_MS },
    ]);

    const { page } = await fetchFirstPage(2);

    expect(page?.entries.map((e) => e.id)).toEqual([1, 2]);
    expect(windows.map((w) => (w.end - w.start) / DAY_MS)).toEqual([1, 2, 1]);
  });

  it("walks back to the archive's first row, logged the evening of 2004-11-03, and reports reachedStart there", async () => {
    const firstRow = Date.parse("2004-11-04T03:06:41.391Z");
    vi.spyOn(Date, "now").mockReturnValue(firstRow + 30 * DAY_MS);
    const windows = serveArchive([
      { id: 154, at: firstRow },
      { id: 155, at: firstRow + 20 * DAY_MS },
    ]);

    const { page } = await fetchFirstPage(50);

    expect(page?.entries.map((e) => e.id)).toEqual([154, 155]);
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

    const { page } = await fetchFirstPage(2);

    expect(windows).toHaveLength(MAX_WINDOWS_PER_PAGE);
    expect(page?.entries.map((e) => e.id)).toEqual([7]);
    expect(page?.reachedStart).toBe(false);
    // Nothing new is a gap, however many rows came back.
    expect(windows.slice(0, 5).map((w) => (w.end - w.start) / DAY_MS)).toEqual([1, 1, 2, 4, 8]);
  });

  it("dedupes an entry the server re-sends across an overlapping window boundary", async () => {
    // The row nearest the boundary (id 31) reappears in the older window too.
    queueRangeResponses([
      json({ shows: [], entries: [rangeEntry(31)] }),
      json({ shows: [], entries: [rangeEntry(10), rangeEntry(31)] }),
    ]);

    const { page } = await fetchFirstPage(2);

    expect(page?.entries.map((e) => e.id)).toEqual([10, 31]);
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
