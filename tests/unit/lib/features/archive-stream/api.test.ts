import { describe, it, expect, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import type { FlowsheetRangeEntry, FlowsheetRangeResponse } from "@wxyc/shared";
import {
  archiveStreamApi,
  useGetArchiveStreamQuery,
  MAX_CONSECUTIVE_EMPTY_WINDOWS,
} from "@/lib/features/archive-stream/api";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { describeApi } from "@/tests/helpers/api-harness";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const MAX_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;
const EMPTY_PAGE: FlowsheetRangeResponse = { shows: [], entries: [] };

function rangeEntry(id: number): FlowsheetRangeEntry {
  return { id, play_order: id, show_id: 1, request_flag: false, entry_type: "track" };
}

function archiveStreamStore() {
  return configureStore({
    reducer: { [archiveStreamApi.reducerPath]: archiveStreamApi.reducer },
    middleware: (gdm) => gdm().concat(archiveStreamApi.middleware),
  });
}

/**
 * Serves `pages` in order, one per request, repeating the final entry once
 * exhausted so a test that only cares about the first few calls doesn't have
 * to pad the queue out to the empty-window bound. A `null` page stands in for
 * an unparseable body. Returns the captured request params in call order.
 */
function queueRangeResponses(
  pages: (FlowsheetRangeResponse | null)[],
): URLSearchParams[] {
  const requests: URLSearchParams[] = [];
  let index = 0;
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/range`, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      const page = pages[Math.min(index, pages.length - 1)];
      index += 1;
      return page === null
        ? new HttpResponse("<!DOCTYPE html><html></html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          })
        : HttpResponse.json(page);
    }),
  );
  return requests;
}

describe("archiveStreamApi", () => {
  describeApi(archiveStreamApi, {
    queries: ["getArchiveStream"],
    reducerPath: "archiveStreamApi",
  });

  it("exports the useGetArchiveStreamQuery hook", () => {
    expect(typeof useGetArchiveStreamQuery).toBe("function");
  });

  it("requests successive windows as integer epoch milliseconds no wider than the 8-day cap", async () => {
    const requests = queueRangeResponses([EMPTY_PAGE]);

    const store = archiveStreamStore();
    await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({
        cursor: 1_756_526_400_000,
        pageSize: 5,
      }),
    );

    expect(requests.length).toBe(MAX_CONSECUTIVE_EMPTY_WINDOWS);
    for (const params of requests) {
      const start = params.get("start")!;
      const end = params.get("end")!;
      expect(start).toMatch(/^\d+$/);
      expect(end).toMatch(/^\d+$/);
      expect(Number(end) - Number(start)).toBeGreaterThan(0);
      expect(Number(end) - Number(start)).toBeLessThanOrEqual(MAX_WINDOW_MS);
    }
  });

  it("walks backward across windows, accumulating in chronological order until pageSize is met", async () => {
    const newerWindow: FlowsheetRangeResponse = {
      shows: [],
      entries: [rangeEntry(30), rangeEntry(31)],
    };
    const olderWindow: FlowsheetRangeResponse = {
      shows: [],
      entries: [rangeEntry(10), rangeEntry(11)],
    };
    const requests = queueRangeResponses([newerWindow, olderWindow]);

    const store = archiveStreamStore();
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({
        cursor: 1_756_526_400_000,
        pageSize: 3,
      }),
    );

    expect(requests.length).toBe(2);
    expect(result.data?.entries.map((e) => e.id)).toEqual([10, 11, 30, 31]);
    expect(result.data?.reachedStart).toBe(false);
    expect(result.data?.nextCursor).toBe(Number(requests[1].get("start")));
  });

  it("dedupes an entry the server re-sends across an overlapping window boundary", async () => {
    const newerWindow: FlowsheetRangeResponse = {
      shows: [],
      entries: [rangeEntry(31)],
    };
    // The row nearest the boundary (id 31) reappears here too.
    const olderWindow: FlowsheetRangeResponse = {
      shows: [],
      entries: [rangeEntry(10), rangeEntry(31)],
    };
    queueRangeResponses([newerWindow, olderWindow]);

    const store = archiveStreamStore();
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({
        cursor: 1_756_526_400_000,
        pageSize: 2,
      }),
    );

    expect(result.data?.entries.map((e) => e.id)).toEqual([10, 31]);
  });

  it("tolerates a run of empty windows shorter than the bound without ending the walk", async () => {
    const emptyRun = Array(MAX_CONSECUTIVE_EMPTY_WINDOWS - 1).fill(EMPTY_PAGE);
    const populated: FlowsheetRangeResponse = { shows: [], entries: [rangeEntry(1)] };
    const requests = queueRangeResponses([...emptyRun, populated]);

    const store = archiveStreamStore();
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({
        cursor: 1_756_526_400_000,
        pageSize: 1,
      }),
    );

    expect(requests.length).toBe(MAX_CONSECUTIVE_EMPTY_WINDOWS);
    expect(result.data?.entries.map((e) => e.id)).toEqual([1]);
    expect(result.data?.reachedStart).toBe(false);
  });

  it("reports reachedStart (not just a short page) once the empty-window bound is exceeded", async () => {
    const requests = queueRangeResponses([EMPTY_PAGE]);

    const store = archiveStreamStore();
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({
        cursor: 1_756_526_400_000,
        pageSize: 50,
      }),
    );

    expect(requests.length).toBe(MAX_CONSECUTIVE_EMPTY_WINDOWS);
    expect(result.data?.entries).toEqual([]);
    expect(result.data?.reachedStart).toBe(true);
    expect(result.data?.nextCursor).toBeNull();
  });

  it("treats an unparseable window body as empty rather than throwing", async () => {
    queueRangeResponses([null]);

    const store = archiveStreamStore();
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({
        cursor: 1_756_526_400_000,
        pageSize: 1,
      }),
    );

    expect(result.isError).toBeFalsy();
    expect(result.data?.entries).toEqual([]);
    expect(result.data?.reachedStart).toBe(true);
  });

  it("propagates a genuine backend error instead of masking it as an empty window", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/range`, () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );

    const store = archiveStreamStore();
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({
        cursor: 1_756_526_400_000,
        pageSize: 1,
      }),
    );

    expect(result.isError).toBe(true);
  });
});
