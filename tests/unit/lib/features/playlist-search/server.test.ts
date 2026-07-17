import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchRecentPlaylistsSeed } from "@/lib/features/playlist-search/server";
import type { PlaylistSearchResult } from "@wxyc/shared";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

function makeResult(id: number): PlaylistSearchResult {
  return {
    id,
    play_date: "2024-11-01T00:00:00Z",
    artist_name: "Stereolab",
    track_title: "Miss Modular",
    album_title: "Dots and Loops",
    record_label: "Duophonic",
    dj_name: "DJ Test",
    show_id: 1,
  };
}

describe("fetchRecentPlaylistsSeed", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend.test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the empty-query first page and returns its rows", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: [makeResult(1), makeResult(2)],
        total: 2,
        page: 0,
        totalPages: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const seed = await fetchRecentPlaylistsSeed();
    expect(seed.results).toHaveLength(2);

    const requestedUrl = String(
      (fetchMock.mock.calls[0] as unknown as unknown[])[0],
    );
    expect(requestedUrl).toContain("/flowsheet/search?");
    expect(requestedUrl).toContain("q=");
    expect(requestedUrl).toContain("sort=date");
    expect(requestedUrl).toContain("order=desc");
    expect(requestedUrl).toContain("limit=50");
  });

  it("fails open to an empty seed on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(null, false)));
    const seed = await fetchRecentPlaylistsSeed();
    expect(seed).toEqual({ results: [] });
  });

  it("fails open to an empty seed when the fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const seed = await fetchRecentPlaylistsSeed();
    expect(seed).toEqual({ results: [] });
  });
});
