import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

import { fetchArchiveStreamSeed } from "@/lib/features/archive-stream/server";
import { computeHeadWindow } from "@/lib/features/archive-stream/head-window";
import { archiveStreamApi } from "@/lib/features/archive-stream/api";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server as mswServer } from "@/tests/fakes/server";
import type { FlowsheetRangeEntry } from "@wxyc/shared";

const NOW = Date.parse("2026-09-26T16:00:00.000Z");

function rangeEntry(id: number): FlowsheetRangeEntry {
  return {
    id,
    play_order: id,
    show_id: 1,
    request_flag: false,
    entry_type: "track",
  };
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

describe("fetchArchiveStreamSeed", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend.test";
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests exactly the head page's first window", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ shows: [], entries: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchArchiveStreamSeed();

    const head = computeHeadWindow(NOW);
    const requestedUrl = new URL(String((fetchMock.mock.calls[0] as unknown as unknown[])[0]));
    expect(requestedUrl.pathname).toBe("/flowsheet/range");
    expect(requestedUrl.searchParams.get("start")).toBe(String(head.start));
    expect(requestedUrl.searchParams.get("end")).toBe(String(head.requestEnd));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("orders entries newest first, the reverse of the wire's oldest-first order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ shows: [], entries: [rangeEntry(1), rangeEntry(2), rangeEntry(3)] }),
      ),
    );

    const seed = await fetchArchiveStreamSeed();

    expect(seed.entries.map((e) => e.id)).toEqual([3, 2, 1]);
  });

  it("fails open to an empty seed on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(null, false)));

    const seed = await fetchArchiveStreamSeed();

    expect(seed).toEqual({ entries: [] });
  });

  it("fails open to an empty seed when the fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const seed = await fetchArchiveStreamSeed();

    expect(seed).toEqual({ entries: [] });
  });

  it("fails open to an empty seed on an empty response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(undefined)));

    const seed = await fetchArchiveStreamSeed();

    expect(seed).toEqual({ entries: [] });
  });

  it("requests the same window and entry order as the reader's head page", async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = TEST_BACKEND_URL;
    const seedWindows: { start: string | null; end: string | null }[] = [];
    mswServer.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/range`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        seedWindows.push({ start: params.get("start"), end: params.get("end") });
        return HttpResponse.json({
          shows: [],
          entries: [rangeEntry(1), rangeEntry(2)],
        });
      }),
    );

    const seed = await fetchArchiveStreamSeed();

    const store = configureStore({
      reducer: { [archiveStreamApi.reducerPath]: archiveStreamApi.reducer },
      middleware: (gdm) => gdm().concat(archiveStreamApi.middleware),
    });
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({ pageSize: 2 }),
    );

    expect(seedWindows).toHaveLength(2);
    expect(seedWindows[0]).toEqual(seedWindows[1]);
    expect(seed.entries.map((e) => e.id)).toEqual(
      result.data?.pages[0]?.entries.map((e) => e.id),
    );
  });
});
