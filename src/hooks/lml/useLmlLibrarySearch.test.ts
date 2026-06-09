import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";
import {
  server,
  createTestLmlLibraryItem,
  createTestStore,
  TEST_BACKEND_URL,
} from "@/lib/test-utils";
import type { AppStore } from "@/lib/store";
import { useLmlLibrarySearch } from "./useLmlLibrarySearch";
import type { LmlLibrarySearchResponse } from "./types";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-jwt-token"),
}));

const PROXY_SEARCH_URL = `${TEST_BACKEND_URL}/proxy/library/search`;

function withStore(store: AppStore = createTestStore()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(Provider, { store, children });
  };
}

describe("useLmlLibrarySearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return empty array when query is too short", async () => {
    const { result } = renderHook(
      () => useLmlLibrarySearch({ artist: "a", album: "" }),
      { wrapper: withStore() }
    );

    await vi.advanceTimersByTimeAsync(400);

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("should send correct query params to Backend-Service proxy", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(PROXY_SEARCH_URL, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          results: [],
          total: 0,
          query: "Juana Molina",
        } satisfies LmlLibrarySearchResponse);
      })
    );

    renderHook(
      () => useLmlLibrarySearch({ artist: "Juana Molina", album: "DOGA" }),
      { wrapper: withStore() }
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(capturedUrl).toBeDefined());

    expect(capturedUrl!.searchParams.get("artist")).toBe("Juana Molina");
    expect(capturedUrl!.searchParams.get("title")).toBe("DOGA");
    expect(capturedUrl!.searchParams.get("limit")).toBe("10");
  });

  it("should include Authorization header", async () => {
    let capturedHeaders: Headers | undefined;
    server.use(
      http.get(PROXY_SEARCH_URL, ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({
          results: [],
          total: 0,
          query: null,
        } satisfies LmlLibrarySearchResponse);
      })
    );

    renderHook(
      () => useLmlLibrarySearch({ artist: "Stereolab", album: "Aluminum" }),
      { wrapper: withStore() }
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(capturedHeaders).toBeDefined());

    expect(capturedHeaders!.get("Authorization")).toMatch(/^Bearer /);
  });

  it("should convert results to AlbumEntry[]", async () => {
    const lmlItem = createTestLmlLibraryItem({
      id: 99,
      title: "Moon Pix",
      artist: "Cat Power",
      call_letters: "RO",
      artist_call_number: 23,
      release_call_number: 5,
      genre: "Rock",
      format: "CD",
    });

    server.use(
      http.get(PROXY_SEARCH_URL, () => {
        return HttpResponse.json({
          results: [lmlItem],
          total: 1,
          query: "Cat Power",
        } satisfies LmlLibrarySearchResponse);
      })
    );

    const { result } = renderHook(
      () => useLmlLibrarySearch({ artist: "Cat Power", album: "Moon" }),
      { wrapper: withStore() }
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(result.current.results.length).toBe(1));

    expect(result.current.results[0]).toEqual(
      expect.objectContaining({
        id: 99,
        title: "Moon Pix",
        artist: expect.objectContaining({
          name: "Cat Power",
          lettercode: "RO",
        }),
        format: "CD",
        label: "",
      })
    );
  });

  it("should return empty array on HTTP error", async () => {
    server.use(
      http.get(PROXY_SEARCH_URL, () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(
      () => useLmlLibrarySearch({ artist: "Stereolab", album: "Aluminum" }),
      { wrapper: withStore() }
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.results).toEqual([]);
  });

  it("should return empty array on network error", async () => {
    server.use(
      http.get(PROXY_SEARCH_URL, () => {
        return HttpResponse.error();
      })
    );

    const { result } = renderHook(
      () => useLmlLibrarySearch({ artist: "Anne Gillis", album: "Eyry" }),
      { wrapper: withStore() }
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.results).toEqual([]);
  });

  it("should debounce requests", async () => {
    let callCount = 0;
    server.use(
      http.get(PROXY_SEARCH_URL, () => {
        callCount++;
        return HttpResponse.json({
          results: [],
          total: 0,
          query: null,
        } satisfies LmlLibrarySearchResponse);
      })
    );

    const { rerender } = renderHook(
      ({ artist, album }) => useLmlLibrarySearch({ artist, album }),
      {
        initialProps: { artist: "Jua", album: "" },
        wrapper: withStore(),
      }
    );

    // Change query before debounce fires
    await vi.advanceTimersByTimeAsync(100);
    rerender({ artist: "Juan", album: "" });
    await vi.advanceTimersByTimeAsync(100);
    rerender({ artist: "Juana", album: "" });

    // Wait for debounce + fetch
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(callCount).toBeGreaterThan(0));

    // Only one request should have been made
    expect(callCount).toBe(1);
  });

  it("dedupes parallel subscribers on identical args (the #563 fix)", async () => {
    // Two subscribers in the SAME store mount the hook with the same args.
    // RTK Query should share one in-flight request and one cache entry; the
    // pre-#563 raw-fetch model fired one per subscriber.
    let callCount = 0;
    server.use(
      http.get(PROXY_SEARCH_URL, () => {
        callCount++;
        return HttpResponse.json({
          results: [],
          total: 0,
          query: null,
        } satisfies LmlLibrarySearchResponse);
      })
    );

    const store = createTestStore();
    renderHook(
      () => useLmlLibrarySearch({ artist: "Stereolab", album: "Aluminum" }),
      { wrapper: withStore(store) }
    );
    renderHook(
      () => useLmlLibrarySearch({ artist: "Stereolab", album: "Aluminum" }),
      { wrapper: withStore(store) }
    );
    renderHook(
      () => useLmlLibrarySearch({ artist: "Stereolab", album: "Aluminum" }),
      { wrapper: withStore(store) }
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(callCount).toBeGreaterThan(0));

    expect(callCount).toBe(1);
  });

  describe("compilation-indicator short-circuit", () => {
    it.each([
      ["Various Artists", "In-Correcto 15-25"],
      ["various artists", "Some Album"],
      ["V/A", "Some Album"],
      ["v.a.", "Some Album"],
      ["Soundtrack", "Movie Title"],
    ])(
      "fires zero network calls for artist=%s album=%s",
      async (artist, album) => {
        let callCount = 0;
        server.use(
          http.get(PROXY_SEARCH_URL, () => {
            callCount++;
            return HttpResponse.json({
              results: [],
              total: 0,
              query: null,
            } satisfies LmlLibrarySearchResponse);
          })
        );

        const { result } = renderHook(
          () => useLmlLibrarySearch({ artist, album }),
          { wrapper: withStore() }
        );

        await vi.advanceTimersByTimeAsync(400);

        expect(callCount).toBe(0);
        expect(result.current.results).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      }
    );

    it("non-compilation artist still fires the network call", async () => {
      let callCount = 0;
      server.use(
        http.get(PROXY_SEARCH_URL, () => {
          callCount++;
          return HttpResponse.json({
            results: [],
            total: 0,
            query: null,
          } satisfies LmlLibrarySearchResponse);
        })
      );

      renderHook(
        () => useLmlLibrarySearch({ artist: "Juana Molina", album: "DOGA" }),
        { wrapper: withStore() }
      );

      await vi.advanceTimersByTimeAsync(400);
      await waitFor(() => expect(callCount).toBe(1));
    });
  });

  it("isLoading is true while debounce is pending for a valid query", async () => {
    server.use(
      http.get(PROXY_SEARCH_URL, () =>
        HttpResponse.json({
          results: [],
          total: 0,
          query: null,
        } satisfies LmlLibrarySearchResponse)
      )
    );

    const { result } = renderHook(
      () => useLmlLibrarySearch({ artist: "Stere", album: "" }),
      { wrapper: withStore() }
    );

    // Before debounce settles, isLoading should be true (valid query, but
    // debouncedArgs not yet updated).
    expect(result.current.isLoading).toBe(true);

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
