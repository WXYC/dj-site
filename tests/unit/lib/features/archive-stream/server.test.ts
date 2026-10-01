import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchArchiveStreamSeed } from "@/lib/features/archive-stream/server";
import { computeHeadWindow, DAY_MS } from "@/lib/features/archive-stream/head-window";
import { archiveStreamApi } from "@/lib/features/archive-stream/api";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { rangeEntry, archiveStreamStore, serveArchive } from "@/tests/fakes/flowsheetRange";

const NOW = Date.parse("2026-09-26T16:00:00.000Z");

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

  it("requests the same window as the reader's head page, and that window's entries lead the reader's first page", async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = TEST_BACKEND_URL;
    // One row inside the head window and one a day further back, so a
    // pageSize of 2 forces the reader to walk a second, older window before
    // it has enough rows -- otherwise the seed (the head window alone) and
    // the reader's first page would coincidentally hold the same rows
    // regardless of whether the seed is actually a prefix of the page.
    const windows = serveArchive([
      { id: 2, at: NOW - 60_000 },
      { id: 1, at: NOW - 1.5 * DAY_MS },
    ]);

    const seed = await fetchArchiveStreamSeed();

    const store = archiveStreamStore();
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({ pageSize: 2 }),
    );

    // The seed's request is the reader's first window, and the reader went
    // on to a second, older one to fill the page.
    expect(windows).toHaveLength(3);
    expect([windows[0].params.get("start"), windows[0].params.get("end")]).toEqual([
      windows[1].params.get("start"),
      windows[1].params.get("end"),
    ]);
    expect(seed.entries.map((e) => e.id)).toEqual([2]);

    const firstPageIds = result.data?.pages[0]?.entries.map((e) => e.id);
    expect(firstPageIds).toEqual([2, 1]);
    // The seed must be a prefix of the reader's first page, not the whole of
    // it, since a multi-window page holds rows the seed never requested.
    expect(firstPageIds?.slice(0, seed.entries.length)).toEqual(seed.entries.map((e) => e.id));
  });
});
